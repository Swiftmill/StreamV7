#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const slugify = require('slugify');
const lockfile = require('proper-lockfile');
const {
  movieSchema,
  seriesSchema,
  categorySchema,
  userSchema
} = require('../lib/schemas');

const dataDir = path.join(__dirname, '..', 'data');
const catalogDir = path.join(dataDir, 'catalog');
const moviesDir = path.join(catalogDir, 'movies');
const seriesDir = path.join(catalogDir, 'series');
const categoriesPath = path.join(dataDir, 'categories', 'categories.json');
const usersDir = path.join(dataDir, 'users');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeAtomic(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const release = lockfile.lockSync(path.dirname(filePath), {
    retries: { retries: 5, minTimeout: 50, maxTimeout: 200 }
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

function createMovies() {
  const subtitleTracks = [
    {
      lang: 'en',
      label: 'English',
      url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_en.vtt'
    },
    {
      lang: 'fr',
      label: 'Français',
      url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_fr.vtt'
    }
  ];

  const movieTemplates = [
    {
      id: 'f7604ddc-0109-4a72-84ab-37b3158c8a6d',
      title: 'Inception',
      description: "Un voleur d'idées s'aventure dans les rêves pour changer la réalité.",
      genres: ['Science-Fiction', 'Thriller'],
      releaseYear: 2010,
      durationMinutes: 148,
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
      categories: ['blockbusters', 'science-fiction']
    },
    {
      id: 'b7510bc8-a442-447f-b27c-12b42622453d',
      title: 'Interstellar',
      description: 'Une équipe explore un trou de ver à la recherche d’un nouveau foyer pour l’humanité.',
      genres: ['Science-Fiction', 'Drame'],
      releaseYear: 2014,
      durationMinutes: 169,
      streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/zny86ZHZF9dC9ZuRJu2PpUtN2ye.jpg',
      categories: ['science-fiction']
    },
    {
      id: 'f483d014-5b95-4c4f-b837-99a48b53dd9c',
      title: 'The Dark Knight',
      description: 'Batman affronte le Joker dans un combat pour l’âme de Gotham.',
      genres: ['Action', 'Crime'],
      releaseYear: 2008,
      durationMinutes: 152,
      streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/8Qsr8pvDL3s1jNZQ4HK1d1Xlvnh.jpg',
      categories: ['blockbusters']
    },
    {
      id: '73bded1a-58c2-45e3-9304-87e74021e728',
      title: 'Roma',
      description: 'Chronique intime de la vie d’une famille mexicaine dans les années 70.',
      genres: ['Drame'],
      releaseYear: 2018,
      durationMinutes: 135,
      streamUrl: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/dOcdBuYdA52xF6cKMnF8TGcP4tW.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/qmDU9lEi5Gx9f3xB2S7R5pTKtyf.jpg',
      categories: ['science-fiction']
    },
    {
      id: 'e84b7b0c-f380-486a-8108-edb7fe42683f',
      title: 'The Irishman',
      description: "Un tueur à gages se remémore sa vie au sein de la mafia américaine.",
      genres: ['Crime', 'Drame'],
      releaseYear: 2019,
      durationMinutes: 209,
      streamUrl: 'https://test-streams.mux.dev/angel-one/angel-one.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/qb4qS1ViyJFu8UPri6P0RcbepcB.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/mbm8k3GFhXS0ROd9AD1gqYbIFbM.jpg',
      categories: ['blockbusters']
    },
    {
      id: '20dffed8-e50f-4cca-a41d-825080993f3b',
      title: 'Bird Box',
      description: "Dans un monde apocalyptique, une mère protège ses enfants d'une force invisible.",
      genres: ['Horreur', 'Thriller'],
      releaseYear: 2018,
      durationMinutes: 124,
      streamUrl: 'https://test-streams.mux.dev/afbw/afbw.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/rGfGfgL2pEPCfhIvqHXieXFn7gp.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/ntAiQbN2A1g6Z9erjRzCQXD1HzX.jpg',
      categories: ['science-fiction']
    },
    {
      id: 'df91a4a4-a1ce-4aa8-b5fd-f8db4c21b381',
      title: 'Extraction',
      description: 'Un mercenaire est envoyé pour sauver le fils kidnappé d’un criminel international.',
      genres: ['Action'],
      releaseYear: 2020,
      durationMinutes: 117,
      streamUrl: 'https://test-streams.mux.dev/tesla-dashcam/playlist.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/wlfDxbGEsW58vGhFljKkcR5IxDj.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/7kCEUv6qCI5PZr15zECw5hbbt7o.jpg',
      categories: ['blockbusters']
    },
    {
      id: 'cf69adee-e1ca-42f5-9a79-9cb74032b65e',
      title: 'The Old Guard',
      description: 'Une équipe de guerriers immortels lutte pour protéger leur secret.',
      genres: ['Action', 'Fantastique'],
      releaseYear: 2020,
      durationMinutes: 125,
      streamUrl: 'https://test-streams.mux.dev/sintel/index.m3u8',
      posterUrl: 'https://image.tmdb.org/t/p/w500/cjr4NWURcVN3gW5FlHeabgBHLrY.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/mBbJgFf9mlBZIFWE3wzY7KXvL9k.jpg',
      categories: ['science-fiction']
    }
  ];

  return movieTemplates.map((template, index) => {
    const movie = {
      ...template,
      type: 'movie',
      subtitles: subtitleTracks,
      createdAt: new Date(2024, 0, index + 1).toISOString(),
      published: true,
      featured: index < 3,
      views: 50000 + index * 4500,
      languages: ['en', 'fr']
    };
    const parsed = movieSchema.parse(movie);
    writeAtomic(path.join(moviesDir, `${parsed.id}.json`), parsed);
    return parsed;
  });
}

function createSeries() {
  const subtitleTracks = [
    {
      lang: 'en',
      label: 'English',
      url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_en.vtt'
    },
    {
      lang: 'fr',
      label: 'Français',
      url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_fr.vtt'
    }
  ];

  const seriesTemplates = [
    {
      id: '4b3e0434-f5b7-4873-81b3-c3aa68fafc42',
      title: 'Stranger Worlds',
      description: "Un groupe d'adolescents découvre un passage vers une dimension parallèle.",
      genres: ['Science-Fiction', 'Mystère'],
      releaseYear: 2021,
      posterUrl: 'https://image.tmdb.org/t/p/w500/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/yTzRFmUbHECx4Y8bVY5T2s9sO3p.jpg',
      categories: ['series-originales'],
      views: 75000
    },
    {
      id: '56154790-1792-4781-b7e5-a5b730ab1e89',
      title: 'Heist Legends',
      description: 'Des braqueurs orchestrent des coups impossibles à travers le globe.',
      genres: ['Action', 'Thriller'],
      releaseYear: 2022,
      posterUrl: 'https://image.tmdb.org/t/p/w500/moT6uH6C62f7bPiwR5qX6F12Hh3.jpg',
      heroUrl: 'https://image.tmdb.org/t/p/original/wu1uilmhM4TdluKi2ytfz8gidHf.jpg',
      categories: ['series-originales'],
      views: 82000
    }
  ];

  return seriesTemplates.map((template, seriesIndex) => {
    const slug = slugify(template.title, { lower: true, strict: true });
    const episodes = Array.from({ length: 6 }).map((_, episodeIndex) => ({
      season: 1,
      episode: episodeIndex + 1,
      title: `Episode ${episodeIndex + 1}`,
      description: `L'épisode ${episodeIndex + 1} développe les enjeux dramatiques de la saison.`,
      durationMinutes: 52,
      streamUrl: episodeIndex % 2 === 0 ? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' : 'https://test-streams.mux.dev/pts_shift/master.m3u8',
      subtitles: subtitleTracks,
      releaseDate: new Date(2024, seriesIndex, episodeIndex + 1).toISOString(),
      published: true
    }));

    const seriesPayload = {
      ...template,
      type: 'series',
      slug,
      streamUrl: episodes[0].streamUrl,
      subtitles: subtitleTracks,
      createdAt: new Date(2024, 0, 5 + seriesIndex).toISOString(),
      published: true,
      featured: seriesIndex === 0,
      seasons: [
        {
          season: 1,
          episodes
        }
      ],
      totalSeasons: 1,
      totalEpisodes: episodes.length
    };

    const parsed = seriesSchema.parse(seriesPayload);
    writeAtomic(path.join(seriesDir, `${parsed.slug}.json`), parsed);
    return parsed;
  });
}

function createCategories() {
  const categories = [
    {
      id: 'blockbusters',
      name: 'Blockbusters',
      order: 0,
      type: 'movie',
      createdAt: new Date(2024, 0, 1).toISOString()
    },
    {
      id: 'science-fiction',
      name: 'Science-Fiction',
      order: 1,
      type: 'mixed',
      createdAt: new Date(2024, 0, 1).toISOString()
    },
    {
      id: 'series-originales',
      name: 'Séries originales',
      order: 2,
      type: 'series',
      createdAt: new Date(2024, 0, 1).toISOString()
    }
  ];
  categories.forEach((category) => categorySchema.parse(category));
  writeAtomic(categoriesPath, categories);
  return categories;
}

function createUsers() {
  const admins = [
    {
      id: '6e4344c9-8161-4a8a-8e95-caaa46b82afb',
      username: 'admin',
      password: '$2b$12$C6UzMDM.H6dfI/f/IKcEe.fFdgu8bZzH0EFEn7TiwlzNlOFaPb8gW',
      role: 'admin',
      createdAt: new Date(2024, 0, 1).toISOString()
    }
  ];

  const users = [
    {
      id: '2bc01843-cc08-4ece-aa58-0040e36a9b74',
      username: 'user',
      password: '$2b$12$1q9B8p1q9B8p1q9B8p1q9uLoa931jkGabo8HoRE3pVTSgud7bN2gS',
      role: 'user',
      createdAt: new Date(2024, 0, 2).toISOString()
    }
  ];

  admins.forEach((admin) => userSchema.parse(admin));
  users.forEach((user) => userSchema.parse(user));

  writeAtomic(path.join(usersDir, 'admin.json'), admins);
  writeAtomic(path.join(usersDir, 'users.json'), users);
}

function main() {
  ensureDir(moviesDir);
  ensureDir(seriesDir);
  ensureDir(path.join(dataDir, 'categories'));
  ensureDir(path.join(dataDir, 'users', 'history'));

  const movies = createMovies();
  const series = createSeries();
  const categories = createCategories();
  createUsers();

  console.log(`Seed terminé: ${movies.length} films, ${series.length} séries, ${categories.length} catégories.`);
}

main();
