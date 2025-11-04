'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import type { Movie, Series, HistoryEntry, Category } from '@/lib/schemas';
import type { SessionResponse } from '@/lib/types';

interface Props {
  session: SessionResponse;
  movies: Movie[];
  series: Series[];
  categories: Category[];
  history: HistoryEntry[];
}

interface RowConfig {
  id: string;
  title: string;
  items: (Movie | Series)[];
}

const previewDelay = 300;
const previewDuration = 3000;

function sanitizeDescription(description: string) {
  return DOMPurify.sanitize(description);
}

function getHeroMedia(movies: Movie[], series: Series[]) {
  const featuredMovies = movies.filter((movie) => movie.featured && movie.published);
  const featuredSeries = series.filter((show) => show.featured && show.published);
  if (featuredMovies.length + featuredSeries.length === 0) {
    return movies[0] ?? series[0] ?? null;
  }
  const pool = [...featuredMovies, ...featuredSeries];
  return pool[Math.floor(Math.random() * pool.length)];
}

function usePreview() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const handleEnter = (id: string) => {
    if (timer) {
      clearTimeout(timer);
    }
    const timeout = setTimeout(() => {
      setActiveId(id);
      setTimeout(() => {
        setActiveId(null);
      }, previewDuration);
    }, previewDelay);
    setTimer(timeout);
  };

  const handleLeave = () => {
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
    setActiveId(null);
  };

  return { activeId, handleEnter, handleLeave };
}

function sortByViews(items: (Movie | Series)[]) {
  return [...items].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
}

function sortByCreatedAt(items: (Movie | Series)[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sortByTitle(items: (Movie | Series)[]) {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
}

export default function AppClient({ session, movies, series, categories, history }: Props) {
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'series'>('all');
  const [sortType, setSortType] = useState<'views' | 'recent' | 'alphabetical'>('views');
  const hero = useMemo(() => getHeroMedia(movies, series), [movies, series]);
  const { activeId, handleEnter, handleLeave } = usePreview();

  const continueItems = useMemo(() => {
    return history
      .filter((entry) => entry.progress < 0.95)
      .map((entry) => {
        const pool = entry.type === 'movie' ? movies : series;
        return pool.find((item) => item.id === entry.contentId || item.slug === entry.contentId);
      })
      .filter(Boolean) as (Movie | Series)[];
  }, [history, movies, series]);

  const trendingRows: RowConfig[] = useMemo(() => {
    const trending = sortByViews([...movies, ...series].filter((item) => item.published));
    const newest = sortByCreatedAt([...movies, ...series].filter((item) => item.published));
    return [
      {
        id: 'continue',
        title: 'Continuer la lecture',
        items: continueItems
      },
      {
        id: 'trending',
        title: 'Tendances',
        items: trending.slice(0, 20)
      },
      {
        id: 'popular',
        title: 'Les plus vus',
        items: sortByViews(trending).slice(0, 20)
      },
      {
        id: 'new',
        title: 'Nouveautés',
        items: newest.slice(0, 20)
      }
    ];
  }, [continueItems, movies, series]);

  const categoryRows: RowConfig[] = useMemo(() => {
    return categories
      .sort((a, b) => a.order - b.order)
      .map((category) => {
        const pool = [...movies, ...series].filter((item) => item.categories?.includes(category.id));
        return {
          id: category.id,
          title: category.name,
          items: pool
        };
      })
      .filter((row) => row.items.length > 0);
  }, [categories, movies, series]);

  const filteredItems = useMemo(() => {
    const pool = [...movies, ...series].filter((item) => item.published);
    const filtered = pool.filter((item) => {
      if (filterType === 'all') return true;
      if (filterType === 'movie') return item.type === 'movie';
      return item.type === 'series';
    });
    if (sortType === 'views') {
      return sortByViews(filtered);
    }
    if (sortType === 'recent') {
      return sortByCreatedAt(filtered);
    }
    return sortByTitle(filtered);
  }, [movies, series, filterType, sortType]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div>
      <nav>
        <div className="logo" aria-label="StreamV7">
          StreamV7
        </div>
       <div className="nav-links" role="navigation" aria-label="Navigation principale">
         <Link href="/app" aria-current="page">
           Accueil
         </Link>
          {session.user.role === 'admin' ? (
            <Link href="/admin" prefetch={false}>
              Admin
            </Link>
          ) : null}
       </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)' }}>{session.user.username}</span>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.32)' }}>
            Se déconnecter
          </button>
        </div>
      </nav>

      {hero ? (
        <section
          className="hero"
          style={{ backgroundImage: `url(${hero.heroUrl ?? hero.posterUrl})` }}
          aria-label={`Mise en avant ${hero.title}`}
        >
          <div className="hero-content">
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>{hero.title}</h1>
            <p dangerouslySetInnerHTML={{ __html: sanitizeDescription(hero.description) }} />
            <div className="hero-buttons">
              <Link
                href={hero.type === 'movie' ? `/watch?type=movie&id=${hero.id}` : `/watch?type=series&slug=${hero.slug}&s=1&e=1`}
                className="hero-play"
              >
                <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ▶︎ Lire
                </button>
              </Link>
              <Link href={hero.type === 'movie' ? `/title/movies/${hero.id}` : `/title/series/${hero.slug}`}>
                <button style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.16)' }}>Détails</button>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <main className="layout-container" style={{ display: 'grid', gap: '2.5rem', paddingTop: '2rem' }}>
        <section aria-label="Filtres et tri">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor="filter-type" style={{ color: 'var(--muted)' }}>
                Type
              </label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(event) => setFilterType(event.target.value as typeof filterType)}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: 'var(--text)'
                }}
              >
                <option value="all">Tous</option>
                <option value="movie">Films</option>
                <option value="series">Séries</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor="sort-type" style={{ color: 'var(--muted)' }}>
                Tri
              </label>
              <select
                id="sort-type"
                value={sortType}
                onChange={(event) => setSortType(event.target.value as typeof sortType)}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid rgba(255,255,255,0.16)',
                  color: 'var(--text)'
                }}
              >
                <option value="views">Plus vus</option>
                <option value="recent">Plus récents</option>
                <option value="alphabetical">A–Z</option>
              </select>
            </div>
          </div>
        </section>

        {trendingRows.map((row) =>
          row.items.length === 0 ? null : (
            <section key={row.id} aria-labelledby={`row-${row.id}`}>
              <div className="row-title">
                <h2 id={`row-${row.id}`} className="section-title">
                  {row.title}
                </h2>
              </div>
              <div className="row-scroller" role="list">
                {row.items.map((item) => (
                  <MediaCard
                    key={item.type === 'movie' ? item.id : item.slug}
                    item={item}
                    activeId={activeId}
                    onEnter={handleEnter}
                    onLeave={handleLeave}
                  />
                ))}
              </div>
            </section>
          )
        )}

        {categoryRows.map((row) => (
          <section key={row.id} aria-labelledby={`category-${row.id}`}>
            <div className="row-title">
              <h2 id={`category-${row.id}`} className="section-title">
                {row.title}
              </h2>
            </div>
            <div className="row-scroller" role="list">
              {row.items.map((item) => (
                <MediaCard
                  key={`${row.id}-${item.type === 'movie' ? item.id : item.slug}`}
                  item={item}
                  activeId={activeId}
                  onEnter={handleEnter}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          </section>
        ))}

        <section aria-label="Catalogue complet">
          <h2 className="section-title">Catalogue</h2>
          <div className="card-grid" role="list">
            {filteredItems.map((item) => (
              <MediaCard
                key={`catalog-${item.type === 'movie' ? item.id : item.slug}`}
                item={item}
                activeId={activeId}
                onEnter={handleEnter}
                onLeave={handleLeave}
                compact
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

interface MediaCardProps {
  item: Movie | Series;
  activeId: string | null;
  onEnter: (id: string) => void;
  onLeave: () => void;
  compact?: boolean;
}

function MediaCard({ item, activeId, onEnter, onLeave, compact = false }: MediaCardProps) {
  const id = item.type === 'movie' ? item.id : item.slug;
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (activeId === id) {
      setShowPreview(true);
    } else {
      setShowPreview(false);
    }
  }, [activeId, id]);

  return (
    <article
      role="listitem"
      className="card"
      onMouseEnter={() => onEnter(id)}
      onMouseLeave={() => onLeave()}
      onFocus={() => onEnter(id)}
      onBlur={() => onLeave()}
      tabIndex={0}
    >
      <div style={{ position: 'relative', width: '100%', height: compact ? 200 : 260 }}>
        <Image src={item.posterUrl} alt={item.title} fill priority={false} sizes="(max-width: 768px) 50vw, 25vw" />
        <AnimatePresence>
          {showPreview ? (
            <motion.video
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              muted
              playsInline
              autoPlay
              preload="metadata"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius)' }}
              onLoadedData={(event) => {
                const video = event.currentTarget;
                video.currentTime = 0;
                video.play().catch(() => null);
                setTimeout(() => {
                  video.pause();
                  video.currentTime = 0;
                }, previewDuration);
              }}
              src={item.streamUrl}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <div className="card-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.title}</h3>
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{item.releaseYear}</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
          {item.description.length > 120 ? `${item.description.slice(0, 120)}…` : item.description}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <Link href={item.type === 'movie' ? `/watch?type=movie&id=${item.id}` : `/watch?type=series&slug=${item.slug}&s=1&e=1`}>
            <button style={{ padding: '0.5rem 0.75rem' }}>Lire</button>
          </Link>
          <Link href={item.type === 'movie' ? `/title/movies/${item.id}` : `/title/series/${item.slug}`}>
            <button style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.16)' }}>
              Détails
            </button>
          </Link>
        </div>
      </div>
    </article>
  );
}
