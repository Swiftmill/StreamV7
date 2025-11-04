'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Movie, Series, Category, UserRecord } from '@/lib/schemas';
import type { SessionResponse } from '@/lib/types';

interface AdminClientProps {
  session: SessionResponse;
  movies: Movie[];
  series: Series[];
  categories: Category[];
  users: { admins: Omit<UserRecord, 'password'>[]; users: Omit<UserRecord, 'password'>[] };
}

type TabKey = 'categories' | 'movies' | 'series' | 'users';

function parseArray(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSubtitles(value: string) {
  if (!value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export default function AdminClient({ session, movies, series, categories, users }: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('categories');
  const [movieList, setMovieList] = useState<Movie[]>(movies);
  const [seriesList, setSeriesList] = useState<Series[]>(series);
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [userLists, setUserLists] = useState(users);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sortedCategories = useMemo(() => [...categoryList].sort((a, b) => a.order - b.order), [categoryList]);

  const callApi = async (input: RequestInfo, init?: RequestInit) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(input, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': session.csrfToken,
          ...(init?.headers ?? {})
        },
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Erreur serveur');
      }
      setMessage('Action réussie');
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur inconnue');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryCreate = async (formData: FormData) => {
    const name = String(formData.get('name') ?? '');
    const type = String(formData.get('type') ?? 'mixed') as Category['type'];
    const data = await callApi('/api/catalog/categories', {
      method: 'POST',
      body: JSON.stringify({ name, type })
    });
    setCategoryList((prev) => [...prev, data.category]);
  };

  const handleCategoryReorder = async (nextOrder: Category[]) => {
    const reordered = nextOrder.map((category, index) => ({ ...category, order: index }));
    setCategoryList(reordered);
    await callApi('/api/catalog/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify(reordered.map((category) => ({ id: category.id, order: category.order })))
    });
  };

  const handleMovieCreate = async (formData: FormData) => {
    const payload = {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      genres: parseArray(String(formData.get('genres') ?? '')),
      releaseYear: Number(formData.get('releaseYear') ?? 2020),
      durationMinutes: Number(formData.get('durationMinutes') ?? 60),
      streamUrl: String(formData.get('streamUrl') ?? ''),
      posterUrl: String(formData.get('posterUrl') ?? ''),
      heroUrl: String(formData.get('heroUrl') ?? ''),
      subtitles: parseSubtitles(String(formData.get('subtitles') ?? '')),
      createdAt: new Date().toISOString(),
      published: formData.get('published') === 'on',
      featured: formData.get('featured') === 'on',
      categories: parseArray(String(formData.get('categories') ?? '')),
      languages: parseArray(String(formData.get('languages') ?? ''))
    };
    const data = await callApi('/api/catalog/movies', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setMovieList((prev) => [...prev, data.movie]);
  };

  const handleSeriesCreate = async (formData: FormData) => {
    const seasonsValue = String(formData.get('seasons') ?? '[]');
    let seasons;
    try {
      seasons = JSON.parse(seasonsValue);
    } catch (error) {
      setMessage('JSON des saisons invalide');
      return;
    }
    const payload = {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      genres: parseArray(String(formData.get('genres') ?? '')),
      releaseYear: Number(formData.get('releaseYear') ?? 2020),
      durationMinutes: Number(formData.get('durationMinutes') ?? 45),
      streamUrl: String(formData.get('streamUrl') ?? ''),
      posterUrl: String(formData.get('posterUrl') ?? ''),
      heroUrl: String(formData.get('heroUrl') ?? ''),
      subtitles: parseSubtitles(String(formData.get('subtitles') ?? '')),
      createdAt: new Date().toISOString(),
      published: formData.get('published') === 'on',
      featured: formData.get('featured') === 'on',
      seasons,
      totalSeasons: Number(formData.get('totalSeasons') ?? 1),
      totalEpisodes: Number(formData.get('totalEpisodes') ?? 1),
      categories: parseArray(String(formData.get('categories') ?? ''))
    };
    const data = await callApi('/api/catalog/series', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setSeriesList((prev) => [...prev, data.series]);
  };

  const refreshUsers = async () => {
    const data = await callApi('/api/users');
    setUserLists(data);
    setMessage(null);
  };

  const handleUserCreate = async (formData: FormData) => {
    const payload = {
      username: String(formData.get('username') ?? ''),
      password: String(formData.get('password') ?? ''),
      role: String(formData.get('role') ?? 'user')
    };
    await callApi('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshUsers();
  };

  const handlePublishToggle = async (item: Movie | Series, published: boolean) => {
    const typePath = item.type === 'movie' ? 'movies' : 'series';
    await callApi(`/api/catalog/${typePath}/${item.type === 'movie' ? item.id : item.slug}/${published ? 'publish' : 'unpublish'}`, {
      method: 'POST'
    });
    if (item.type === 'movie') {
      setMovieList((prev) => prev.map((movie) => (movie.id === item.id ? { ...movie, published } : movie)));
    } else {
      setSeriesList((prev) => prev.map((serie) => (serie.slug === item.slug ? { ...serie, published } : serie)));
    }
  };

  const handleFeatureToggle = async (item: Movie | Series, featured: boolean) => {
    const typePath = item.type === 'movie' ? 'movies' : 'series';
    await callApi(`/api/catalog/${typePath}/${item.type === 'movie' ? item.id : item.slug}/${featured ? 'feature' : 'unfeature'}`, {
      method: 'POST'
    });
    if (item.type === 'movie') {
      setMovieList((prev) => prev.map((movie) => (movie.id === item.id ? { ...movie, featured } : movie)));
    } else {
      setSeriesList((prev) => prev.map((serie) => (serie.slug === item.slug ? { ...serie, featured } : serie)));
    }
  };

  const handleUserDisable = async (username: string) => {
    await callApi(`/api/users/${username}/disable`, {
      method: 'PUT'
    });
    await refreshUsers();
  };

  const handleUserReset = async (username: string, password: string) => {
    await callApi(`/api/users/${username}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    });
    await refreshUsers();
  };

  const onCategoryDrag = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updated = [...sortedCategories];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    handleCategoryReorder(updated).catch(() => null);
  };

  return (
    <main className="layout-container" style={{ paddingTop: '2rem', display: 'grid', gap: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2.5rem' }}>Panel Admin</h1>
        <span style={{ color: 'var(--muted)' }}>Connecté : {session.user.username}</span>
      </header>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {(
          [
            { key: 'categories', label: 'Catégories' },
            { key: 'movies', label: 'Films' },
            { key: 'series', label: 'Séries' },
            { key: 'users', label: 'Utilisateurs' }
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message ? (
        <div role="status" style={{ padding: '1rem', borderRadius: 'var(--radius)', background: 'rgba(0,0,0,0.4)' }}>
          {message}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {activeTab === 'categories' ? (
          <motion.section
            key="categories"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="grid"
            style={{ gap: '1.5rem' }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCategoryCreate(new FormData(event.currentTarget)).catch(() => null);
                event.currentTarget.reset();
              }}
              className="grid"
              style={{ gap: '1rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)' }}
            >
              <h2>Créer une catégorie</h2>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Nom</span>
                <input name="name" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Type</span>
                <select name="type" style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }}>
                  <option value="mixed">Mixte</option>
                  <option value="movie">Films</option>
                  <option value="series">Séries</option>
                </select>
              </label>
              <button type="submit" disabled={loading}>
                Ajouter
              </button>
            </form>

            <div className="grid" style={{ gap: '0.75rem' }}>
              {sortedCategories.map((category, index) => (
                <div
                  key={category.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', String(index));
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = Number(event.dataTransfer.getData('text/plain'));
                    onCategoryDrag(from, index);
                  }}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{category.name}</span>
                  <span style={{ color: 'var(--muted)' }}>{category.type}</span>
                </div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {activeTab === 'movies' ? (
          <motion.section
            key="movies"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="grid"
            style={{ gap: '1.5rem' }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleMovieCreate(new FormData(event.currentTarget)).catch(() => null);
                event.currentTarget.reset();
              }}
              className="grid"
              style={{ gap: '1rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)' }}
            >
              <h2>Nouveau film</h2>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Titre</span>
                <input name="title" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Description</span>
                <textarea name="description" required rows={3} style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Genres (séparés par des virgules)</span>
                <input name="genres" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <label className="grid" style={{ gap: '0.5rem' }}>
                  <span>Année</span>
                  <input name="releaseYear" type="number" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
                </label>
                <label className="grid" style={{ gap: '0.5rem' }}>
                  <span>Durée (min)</span>
                  <input
                    name="durationMinutes"
                    type="number"
                    required
                    style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }}
                  />
                </label>
              </div>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>URL stream</span>
                <input name="streamUrl" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>URL poster</span>
                <input name="posterUrl" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>URL hero</span>
                <input name="heroUrl" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Sous-titres (JSON)</span>
                <textarea name="subtitles" rows={3} style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Catégories (ids séparés par des virgules)</span>
                <input name="categories" style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Langues (séparées par des virgules)</span>
                <input name="languages" style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" name="published" /> Publier
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" name="featured" /> Mettre en avant
              </label>
              <button type="submit" disabled={loading}>
                Ajouter le film
              </button>
            </form>

            <div className="grid" style={{ gap: '1rem' }}>
              {movieList.map((movie) => (
                <div key={movie.id} style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                  <h3 style={{ marginTop: 0 }}>{movie.title}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handlePublishToggle(movie, !movie.published)}>
                      {movie.published ? 'Dépublier' : 'Publier'}
                    </button>
                    <button onClick={() => handleFeatureToggle(movie, !movie.featured)}>
                      {movie.featured ? 'Retirer vitrine' : 'Mettre en avant'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {activeTab === 'series' ? (
          <motion.section
            key="series"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="grid"
            style={{ gap: '1.5rem' }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSeriesCreate(new FormData(event.currentTarget)).catch(() => null);
                event.currentTarget.reset();
              }}
              className="grid"
              style={{ gap: '1rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)' }}
            >
              <h2>Nouvelle série</h2>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Titre</span>
                <input name="title" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Description</span>
                <textarea name="description" required rows={3} style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Genres</span>
                <input name="genres" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <label className="grid" style={{ gap: '0.5rem' }}>
                  <span>Année</span>
                  <input name="releaseYear" type="number" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
                </label>
                <label className="grid" style={{ gap: '0.5rem' }}>
                  <span>Durée moyenne (min)</span>
                  <input name="durationMinutes" type="number" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
                </label>
              </div>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>URL stream par défaut</span>
                <input name="streamUrl" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>URL poster</span>
                <input name="posterUrl" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>URL hero</span>
                <input name="heroUrl" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Sous-titres (JSON)</span>
                <textarea name="subtitles" rows={3} style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Catégories</span>
                <input name="categories" style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Total saisons</span>
                <input name="totalSeasons" type="number" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Total épisodes</span>
                <input name="totalEpisodes" type="number" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Saisons (JSON)</span>
                <textarea
                  name="seasons"
                  required
                  rows={4}
                  placeholder='[{"season":1,"episodes":[{"season":1,"episode":1,"title":"Pilote","description":"...","durationMinutes":45,"streamUrl":"https://...","subtitles":[],"releaseDate":"2024-01-01T00:00:00.000Z","published":true}]}]'
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }}
                />
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" name="published" /> Publier
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" name="featured" /> Mettre en avant
              </label>
              <button type="submit" disabled={loading}>
                Ajouter la série
              </button>
            </form>

            <div className="grid" style={{ gap: '1rem' }}>
              {seriesList.map((serie) => (
                <div key={serie.slug} style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                  <h3 style={{ marginTop: 0 }}>{serie.title}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handlePublishToggle(serie, !serie.published)}>
                      {serie.published ? 'Dépublier' : 'Publier'}
                    </button>
                    <button onClick={() => handleFeatureToggle(serie, !serie.featured)}>
                      {serie.featured ? 'Retirer vitrine' : 'Mettre en avant'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {activeTab === 'users' ? (
          <motion.section
            key="users"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="grid"
            style={{ gap: '1.5rem' }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleUserCreate(new FormData(event.currentTarget)).catch(() => null);
                event.currentTarget.reset();
              }}
              className="grid"
              style={{ gap: '1rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)' }}
            >
              <h2>Créer un utilisateur</h2>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Nom d&apos;utilisateur</span>
                <input name="username" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Mot de passe</span>
                <input name="password" type="password" required style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }} />
              </label>
              <label className="grid" style={{ gap: '0.5rem' }}>
                <span>Rôle</span>
                <select name="role" style={{ padding: '0.5rem', borderRadius: 'var(--radius)' }}>
                  <option value="user">Utilisateur</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button type="submit" disabled={loading}>
                Créer
              </button>
            </form>

            <div className="grid" style={{ gap: '1rem' }}>
              {[{ label: 'Admins', items: userLists.admins }, { label: 'Utilisateurs', items: userLists.users }].map((group) => (
                <div key={group.label} style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)' }}>
                  <h2>{group.label}</h2>
                  <div className="grid" style={{ gap: '0.75rem' }}>
                    {group.items.map((user) => (
                      <div
                        key={user.username}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius)',
                          background: 'rgba(0,0,0,0.4)'
                        }}
                      >
                        <div>
                          <strong>{user.username}</strong>
                          <span style={{ marginLeft: '0.5rem', color: 'var(--muted)' }}>{user.role}</span>
                          {user.disabled ? <span style={{ marginLeft: '0.5rem', color: '#ff6b6b' }}>désactivé</span> : null}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleUserDisable(user.username)} disabled={user.disabled}>
                            Désactiver
                          </button>
                          <button
                            onClick={() => {
                              const password = prompt('Nouveau mot de passe');
                              if (password) {
                                handleUserReset(user.username, password).catch(() => null);
                              }
                            }}
                          >
                            Reset MDP
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
