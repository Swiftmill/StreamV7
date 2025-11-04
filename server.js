// @ts-check
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const next = require('next');
const lockfile = require('proper-lockfile');
const slugify = require('slugify');
const cors = require('cors');
const { z } = require('zod');
const {
  movieSchema,
  seriesSchema,
  seriesEpisodeSchema,
  categorySchema,
  userSchema,
  historyEntrySchema
} = require('./lib/schemas');

const app = express();
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: path.join(__dirname) });
const handle = nextApp.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3000', 10);
const SESSION_COOKIE = 'sv7_session';
const CSRF_HEADER = 'x-csrf-token';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'streamv7-cookie-secret';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VIEW_TTL_MS = 24 * 60 * 60 * 1000;

/** @typedef {{ id: string; username: string; role: 'admin' | 'user'; disabled?: boolean }} UserRecord */
/** @typedef {{ id: string; username: string; role: 'admin' | 'user'; csrfToken: string; createdAt: number; lastSeen: number; views: Record<string, number>; }} SessionRecord */

const sessions = new Map();
const adminRateMap = new Map();

const dataDir = path.join(__dirname, 'data');
const usersDir = path.join(dataDir, 'users');
const catalogDir = path.join(dataDir, 'catalog');
const moviesDir = path.join(catalogDir, 'movies');
const seriesDir = path.join(catalogDir, 'series');
const auditLogPath = path.join(dataDir, 'audit.log');
const historyDir = path.join(usersDir, 'history');


function ensureDirectories() {
  [dataDir, usersDir, catalogDir, moviesDir, seriesDir, historyDir, path.join(dataDir, 'categories')].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  if (!fs.existsSync(auditLogPath)) {
    fs.writeFileSync(auditLogPath, '', 'utf8');
  }
}

ensureDirectories();

/**
 * @param {string} filePath
 * @param {unknown} data
 */
function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const targetDir = path.dirname(filePath);
  const release = lockfile.lockSync(targetDir, {
    retries: { retries: 5, minTimeout: 20, maxTimeout: 100 }
  });
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    release();
  }
}

/**
 * @param {string} filePath
 */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

/**
 * @param {string} user
 * @param {string} action
 * @param {string} target
 * @param {Record<string, unknown>} details
 */
function logAudit(user, action, target, details) {
  const entry = `${new Date().toISOString()} | ${user} | ${action} | ${target} | ${JSON.stringify(details)}\n`;
  fs.appendFileSync(auditLogPath, entry, 'utf8');
}

function sanitizeMediaUrl(url) {
  const whitelist = (process.env.STREAM_WHITELIST || 'https://,http://localhost').split(',');
  return whitelist.some((allowed) => allowed && url.startsWith(allowed));
}

function validateMediaPayload(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const error = new Error(parsed.error.issues.map((issue) => issue.message).join('; '));
    error.status = 400;
    throw error;
  }
  if ('streamUrl' in parsed.data && !sanitizeMediaUrl(parsed.data.streamUrl)) {
    const err = new Error('Stream URL non autorisée');
    err.status = 400;
    throw err;
  }
  if ('subtitles' in parsed.data) {
    parsed.data.subtitles.forEach((sub) => {
      if (!sanitizeMediaUrl(sub.url)) {
        const err = new Error('URL de sous-titres non autorisée');
        err.status = 400;
        throw err;
      }
    });
  }
  return parsed.data;
}

function createSession(user) {
  const token = crypto.randomBytes(48).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  /** @type {SessionRecord} */
  const session = {
    id: token,
    username: user.username,
    role: user.role,
    csrfToken,
    createdAt: now,
    lastSeen: now,
    views: {}
  };
  sessions.set(token, session);
  return session;
}

function getSession(req) {
  const token = req.signedCookies?.[SESSION_COOKIE];
  if (!token) {
    return null;
  }
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

function destroySession(token) {
  sessions.delete(token);
}

function authenticate(req, res, nextFn) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  req.user = session;
  return nextFn();
}

function requireRole(role) {
  return (req, res, nextFn) => {
    const session = req.user || getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (session.role !== role) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    req.user = session;
    return nextFn();
  };
}

function adminRateLimit(req, res, nextFn) {
  const session = req.user || getSession(req);
  if (!session || session.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const now = Math.floor(Date.now() / 60000);
  for (const key of adminRateMap.keys()) {
    const [, minute] = key.split(':');
    if (now - Number(minute) > 1) {
      adminRateMap.delete(key);
    }
  }
  const windowKey = `${session.username}:${now}`;
  const current = adminRateMap.get(windowKey) ?? 0;
  if (current >= 10) {
    return res.status(429).json({ error: 'Trop de requêtes admin' });
  }
  adminRateMap.set(windowKey, current + 1);
  nextFn();
}

function requireCsrf(req, res, nextFn) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return nextFn();
  }
  const session = req.user || getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const headerToken = req.headers[CSRF_HEADER];
  if (typeof headerToken !== 'string' || headerToken !== session.csrfToken) {
    return res.status(403).json({ error: 'CSRF token invalide' });
  }
  return nextFn();
}

function loadUsers() {
  const admins = readJsonFile(path.join(usersDir, 'admin.json')) || [];
  const users = readJsonFile(path.join(usersDir, 'users.json')) || [];
  return [...admins, ...users];
}

function saveUsers(admins, users) {
  writeJsonAtomic(path.join(usersDir, 'admin.json'), admins);
  writeJsonAtomic(path.join(usersDir, 'users.json'), users);
}

function getMovieFilePath(id) {
  return path.join(moviesDir, `${id}.json`);
}

function getSeriesFilePath(slug) {
  return path.join(seriesDir, `${slug}.json`);
}

function loadMovie(id) {
  const movie = readJsonFile(getMovieFilePath(id));
  return movie;
}

function loadSeries(slug) {
  return readJsonFile(getSeriesFilePath(slug));
}

function listMovies() {
  if (!fs.existsSync(moviesDir)) {
    return [];
  }
  return fs.readdirSync(moviesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJsonFile(path.join(moviesDir, file)))
    .filter(Boolean);
}

function listSeries() {
  if (!fs.existsSync(seriesDir)) {
    return [];
  }
  return fs.readdirSync(seriesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJsonFile(path.join(seriesDir, file)))
    .filter(Boolean)
    .map((serie) => {
      if (!serie || !Array.isArray(serie.seasons)) {
        return serie;
      }
      serie.seasons = serie.seasons
        .map((season) => ({
          ...season,
          episodes: [...season.episodes].sort((a, b) => a.episode - b.episode)
        }))
        .sort((a, b) => a.season - b.season);
      return serie;
    });
}

function mergeSeriesEpisode(seriesData, episodePayload) {
  const seasons = [...seriesData.seasons];
  const seasonIndex = seasons.findIndex((s) => s.season === episodePayload.season);
  if (seasonIndex === -1) {
    seasons.push({ season: episodePayload.season, episodes: [episodePayload] });
  } else {
    const episodes = [...seasons[seasonIndex].episodes];
    const existingIndex = episodes.findIndex((ep) => ep.episode === episodePayload.episode);
    if (existingIndex === -1) {
      episodes.push(episodePayload);
    } else {
      episodes[existingIndex] = episodePayload;
    }
    seasons[seasonIndex] = {
      season: episodePayload.season,
      episodes: episodes.sort((a, b) => a.episode - b.episode)
    };
  }
  seasons.sort((a, b) => a.season - b.season);
  const totalEpisodes = seasons.reduce((total, season) => total + season.episodes.length, 0);
  return { ...seriesData, seasons, totalEpisodes, totalSeasons: seasons.length };
}

function incrementView(session, contentId) {
  const lastView = session.views[contentId];
  const now = Date.now();
  if (!lastView || now - lastView > VIEW_TTL_MS) {
    session.views[contentId] = now;
    return true;
  }
  return false;
}

nextApp.prepare().then(() => {
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'];
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(COOKIE_SECRET));

  app.use((req, res, nextFn) => {
    res.setHeader('Cache-Control', 'no-store');
    nextFn();
  });

  app.post('/api/auth/login', async (req, res) => {
    const loginSchema = z.object({
      username: z.string().min(3),
      password: z.string().min(6)
    });
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }
    const users = loadUsers();
    const user = users.find((record) => record.username === parsed.data.username);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    if (user.disabled) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }
    const passwordOk = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    const session = createSession(user);
    res.cookie(SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: !dev,
      signed: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS
    });
    logAudit(user.username, 'LOGIN', 'auth', { });
    return res.json({
      user: { username: user.username, role: user.role },
      csrfToken: session.csrfToken
    });
  });

  app.post('/api/auth/logout', authenticate, (req, res) => {
    const token = req.signedCookies?.[SESSION_COOKIE];
    if (token) {
      destroySession(token);
    }
    res.clearCookie(SESSION_COOKIE);
    logAudit(req.user.username, 'LOGOUT', 'auth', {});
    return res.json({ success: true });
  });

  app.get('/api/auth/session', (req, res) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    return res.json({ user: { username: session.username, role: session.role }, csrfToken: session.csrfToken });
  });

  app.post('/api/users', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, async (req, res) => {
    const payload = userSchema.pick({ username: true, role: true }).extend({ password: z.string().min(6) }).safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.flatten() });
    }
    const { username, role, password } = payload.data;
    const users = loadUsers();
    if (users.some((u) => u.username === username)) {
      return res.status(409).json({ error: 'Utilisateur existant' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const newUser = {
      id: crypto.randomUUID(),
      username,
      role,
      password: hashed,
      createdAt: new Date().toISOString()
    };
    const admins = readJsonFile(path.join(usersDir, 'admin.json')) || [];
    const basicUsers = readJsonFile(path.join(usersDir, 'users.json')) || [];
    if (role === 'admin') {
      admins.push(newUser);
    } else {
      basicUsers.push(newUser);
    }
    saveUsers(admins, basicUsers);
    logAudit(req.user.username, 'CREATE_USER', 'user', { username, role });
    return res.status(201).json({ user: { username, role } });
  });

  app.put('/api/users/:username/disable', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const targetUsername = req.params.username;
    const admins = readJsonFile(path.join(usersDir, 'admin.json')) || [];
    const basicUsers = readJsonFile(path.join(usersDir, 'users.json')) || [];
    const all = [...admins, ...basicUsers];
    const record = all.find((u) => u.username === targetUsername);
    if (!record) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    record.disabled = true;
    saveUsers(admins.map((u) => (u.username === targetUsername ? record : u)), basicUsers.map((u) => (u.username === targetUsername ? record : u)));
    logAudit(req.user.username, 'DISABLE_USER', 'user', { username: targetUsername });
    return res.json({ success: true });
  });

  app.put('/api/users/:username/reset-password', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, async (req, res) => {
    const schema = z.object({ password: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const admins = readJsonFile(path.join(usersDir, 'admin.json')) || [];
    const basicUsers = readJsonFile(path.join(usersDir, 'users.json')) || [];
    const update = async (list) => Promise.all(list.map(async (u) => {
      if (u.username === req.params.username) {
        return { ...u, password: await bcrypt.hash(parsed.data.password, 12) };
      }
      return u;
    }));
    const newAdmins = await update(admins);
    const newUsers = await update(basicUsers);
    saveUsers(newAdmins, newUsers);
    logAudit(req.user.username, 'RESET_PASSWORD', 'user', { username: req.params.username });
    return res.json({ success: true });
  });

  app.get('/api/users', authenticate, requireRole('admin'), adminRateLimit, (req, res) => {
    const admins = readJsonFile(path.join(usersDir, 'admin.json')) || [];
    const basicUsers = readJsonFile(path.join(usersDir, 'users.json')) || [];
    const sanitize = (list) => list.map(({ password, ...rest }) => rest);
    return res.json({ admins: sanitize(admins), users: sanitize(basicUsers) });
  });

  app.get('/api/catalog/movies', authenticate, (req, res) => {
    const movies = listMovies();
    return res.json({ movies });
  });

  app.get('/api/catalog/movies/:id', authenticate, (req, res) => {
    const movie = loadMovie(req.params.id);
    if (!movie) {
      return res.status(404).json({ error: 'Film introuvable' });
    }
    return res.json({ movie });
  });

  app.post('/api/catalog/movies', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const id = req.body.id && typeof req.body.id === 'string' ? req.body.id : crypto.randomUUID();
    const validated = validateMediaPayload(movieSchema, { ...req.body, id, type: 'movie' });
    const filePath = getMovieFilePath(validated.id);
    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'Film déjà existant' });
    }
    writeJsonAtomic(filePath, validated);
    logAudit(req.user.username, 'CREATE_MOVIE', 'movie', { id: validated.id });
    return res.status(201).json({ movie: validated });
  });

  app.put('/api/catalog/movies/:id', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const id = req.params.id;
    const existing = loadMovie(id);
    if (!existing) {
      return res.status(404).json({ error: 'Film introuvable' });
    }
    const merged = { ...existing, ...req.body, id, type: 'movie' };
    const validated = validateMediaPayload(movieSchema, merged);
    writeJsonAtomic(getMovieFilePath(id), validated);
    logAudit(req.user.username, 'UPDATE_MOVIE', 'movie', { id });
    return res.json({ movie: validated });
  });

  app.delete('/api/catalog/movies/:id', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const id = req.params.id;
    const filePath = getMovieFilePath(id);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Film introuvable' });
    }
    fs.unlinkSync(filePath);
    logAudit(req.user.username, 'DELETE_MOVIE', 'movie', { id });
    return res.json({ success: true });
  });

  app.get('/api/catalog/series', authenticate, (req, res) => {
    const series = listSeries();
    return res.json({ series });
  });

  app.get('/api/catalog/series/:slug', authenticate, (req, res) => {
    const seriesData = loadSeries(req.params.slug);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    seriesData.seasons = seriesData.seasons
      .map((season) => ({
        ...season,
        episodes: [...season.episodes].sort((a, b) => a.episode - b.episode)
      }))
      .sort((a, b) => a.season - b.season);
    return res.json({ series: seriesData });
  });

  app.post('/api/catalog/series', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const slug = slugify(req.body.title, { lower: true, strict: true });
    const basePayload = { ...req.body, slug, type: 'series' };
    const validated = validateMediaPayload(seriesSchema, basePayload);
    const filePath = getSeriesFilePath(slug);
    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'Série existante' });
    }
    writeJsonAtomic(filePath, validated);
    logAudit(req.user.username, 'CREATE_SERIES', 'series', { slug });
    return res.status(201).json({ series: validated });
  });

  app.post('/api/catalog/series/:slug/episodes', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const slug = req.params.slug;
    const seriesData = loadSeries(slug);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    const validated = seriesEpisodeSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: validated.error.flatten() });
    }
    const merged = mergeSeriesEpisode(seriesData, validated.data);
    writeJsonAtomic(getSeriesFilePath(slug), merged);
    logAudit(req.user.username, 'UPSERT_EPISODE', 'series', { slug, season: validated.data.season, episode: validated.data.episode });
    return res.json({ series: merged });
  });

  app.delete('/api/catalog/series/:slug/seasons/:season/episodes/:episode', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const slug = req.params.slug;
    const seasonNumber = Number(req.params.season);
    const episodeNumber = Number(req.params.episode);
    const seriesData = loadSeries(slug);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    const seasons = seriesData.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.filter((ep) => !(ep.episode === episodeNumber && season.season === seasonNumber))
    })).filter((season) => season.episodes.length > 0);
    const totalEpisodes = seasons.reduce((total, season) => total + season.episodes.length, 0);
    const updated = { ...seriesData, seasons, totalEpisodes, totalSeasons: seasons.length };
    writeJsonAtomic(getSeriesFilePath(slug), updated);
    logAudit(req.user.username, 'DELETE_EPISODE', 'series', { slug, season: seasonNumber, episode: episodeNumber });
    return res.json({ series: updated });
  });

  app.put('/api/catalog/series/:slug', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const slug = req.params.slug;
    const existing = loadSeries(slug);
    if (!existing) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    const merged = { ...existing, ...req.body, type: 'series', slug };
    const validated = validateMediaPayload(seriesSchema, merged);
    writeJsonAtomic(getSeriesFilePath(slug), validated);
    logAudit(req.user.username, 'UPDATE_SERIES', 'series', { slug });
    return res.json({ series: validated });
  });

  app.post('/api/catalog/:type/:id/publish', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const { type, id } = req.params;
    if (type === 'movies') {
      const movie = loadMovie(id);
      if (!movie) {
        return res.status(404).json({ error: 'Film introuvable' });
      }
      movie.published = true;
      writeJsonAtomic(getMovieFilePath(id), movie);
      logAudit(req.user.username, 'PUBLISH_MOVIE', 'movie', { id });
      return res.json({ movie });
    }
    const seriesData = loadSeries(id);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    seriesData.published = true;
    writeJsonAtomic(getSeriesFilePath(id), seriesData);
    logAudit(req.user.username, 'PUBLISH_SERIES', 'series', { slug: id });
    return res.json({ series: seriesData });
  });

  app.post('/api/catalog/:type/:id/unpublish', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const { type, id } = req.params;
    if (type === 'movies') {
      const movie = loadMovie(id);
      if (!movie) {
        return res.status(404).json({ error: 'Film introuvable' });
      }
      movie.published = false;
      writeJsonAtomic(getMovieFilePath(id), movie);
      logAudit(req.user.username, 'UNPUBLISH_MOVIE', 'movie', { id });
      return res.json({ movie });
    }
    const seriesData = loadSeries(id);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    seriesData.published = false;
    writeJsonAtomic(getSeriesFilePath(id), seriesData);
    logAudit(req.user.username, 'UNPUBLISH_SERIES', 'series', { slug: id });
    return res.json({ series: seriesData });
  });

  app.post('/api/catalog/:type/:id/feature', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const { type, id } = req.params;
    if (type === 'movies') {
      const movie = loadMovie(id);
      if (!movie) {
        return res.status(404).json({ error: 'Film introuvable' });
      }
      movie.featured = true;
      writeJsonAtomic(getMovieFilePath(id), movie);
      logAudit(req.user.username, 'FEATURE_MOVIE', 'movie', { id });
      return res.json({ movie });
    }
    const seriesData = loadSeries(id);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    seriesData.featured = true;
    writeJsonAtomic(getSeriesFilePath(id), seriesData);
    logAudit(req.user.username, 'FEATURE_SERIES', 'series', { slug: id });
    return res.json({ series: seriesData });
  });

  app.post('/api/catalog/:type/:id/unfeature', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const { type, id } = req.params;
    if (type === 'movies') {
      const movie = loadMovie(id);
      if (!movie) {
        return res.status(404).json({ error: 'Film introuvable' });
      }
      movie.featured = false;
      writeJsonAtomic(getMovieFilePath(id), movie);
      logAudit(req.user.username, 'UNFEATURE_MOVIE', 'movie', { id });
      return res.json({ movie });
    }
    const seriesData = loadSeries(id);
    if (!seriesData) {
      return res.status(404).json({ error: 'Série introuvable' });
    }
    seriesData.featured = false;
    writeJsonAtomic(getSeriesFilePath(id), seriesData);
    logAudit(req.user.username, 'UNFEATURE_SERIES', 'series', { slug: id });
    return res.json({ series: seriesData });
  });

  app.post('/api/history', authenticate, requireCsrf, (req, res) => {
    const parsed = historyEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const filePath = path.join(historyDir, `${req.user.username}.json`);
    const history = readJsonFile(filePath) || [];
    const index = history.findIndex((entry) => entry.contentId === parsed.data.contentId && entry.type === parsed.data.type);
    if (index === -1) {
      history.push(parsed.data);
    } else {
      history[index] = parsed.data;
    }
    writeJsonAtomic(filePath, history);
    logAudit(req.user.username, 'UPSERT_HISTORY', 'history', { contentId: parsed.data.contentId });
    return res.json({ history });
  });

  app.get('/api/history', authenticate, (req, res) => {
    const filePath = path.join(historyDir, `${req.user.username}.json`);
    const history = readJsonFile(filePath) || [];
    return res.json({ history });
  });

  app.post('/api/metrics/views', authenticate, requireCsrf, (req, res) => {
    const schema = z.object({ contentId: z.string().min(1), type: z.enum(['movie', 'series']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { contentId, type } = parsed.data;
    const session = req.user;
    if (!incrementView(session, `${type}:${contentId}`)) {
      return res.json({ counted: false });
    }
    if (type === 'movie') {
      const movie = loadMovie(contentId);
      if (!movie) {
        return res.status(404).json({ error: 'Film introuvable' });
      }
      movie.views = (movie.views || 0) + 1;
      writeJsonAtomic(getMovieFilePath(contentId), movie);
    } else {
      const seriesData = loadSeries(contentId);
      if (!seriesData) {
        return res.status(404).json({ error: 'Série introuvable' });
      }
      seriesData.views = (seriesData.views || 0) + 1;
      writeJsonAtomic(getSeriesFilePath(contentId), seriesData);
    }
    logAudit(req.user.username, 'INCREMENT_VIEW', type, { contentId });
    return res.json({ counted: true });
  });

  app.get('/api/catalog/categories', authenticate, (req, res) => {
    const categoriesPath = path.join(dataDir, 'categories', 'categories.json');
    const categories = readJsonFile(categoriesPath) || [];
    return res.json({ categories });
  });

  app.post('/api/catalog/categories', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const schema = categorySchema.pick({ name: true, type: true });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const categoriesPath = path.join(dataDir, 'categories', 'categories.json');
    const categories = readJsonFile(categoriesPath) || [];
    const newCategory = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      type: parsed.data.type,
      order: categories.length,
      createdAt: new Date().toISOString()
    };
    categories.push(newCategory);
    writeJsonAtomic(categoriesPath, categories);
    logAudit(req.user.username, 'CREATE_CATEGORY', 'category', { id: newCategory.id });
    return res.status(201).json({ category: newCategory });
  });

  app.put('/api/catalog/categories/reorder', authenticate, requireRole('admin'), adminRateLimit, requireCsrf, (req, res) => {
    const schema = z.array(z.object({ id: z.string().uuid(), order: z.number().int().nonnegative() }));
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const categoriesPath = path.join(dataDir, 'categories', 'categories.json');
    const categories = readJsonFile(categoriesPath) || [];
    const orderMap = new Map(parsed.data.map((item) => [item.id, item.order]));
    const reordered = categories.map((category) => ({ ...category, order: orderMap.get(category.id) ?? category.order })).sort((a, b) => a.order - b.order);
    writeJsonAtomic(categoriesPath, reordered);
    logAudit(req.user.username, 'REORDER_CATEGORY', 'category', {});
    return res.json({ categories: reordered });
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Route inconnue' });
  });

  app.all('*', (req, res) => handle(req, res));

  app.use((err, req, res, nextFn) => {
    const status = err.status || 500;
    if (!res.headersSent) {
      res.status(status).json({ error: err.message || 'Erreur serveur' });
    }
  });

  app.listen(PORT, () => {
    if (dev) {
      console.log(`StreamV7 prêt sur http://localhost:${PORT}`);
    }
  });
}).catch((err) => {
  console.error('Erreur de démarrage', err);
  process.exit(1);
});
