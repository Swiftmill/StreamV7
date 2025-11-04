'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VideoPlayer from '@/components/VideoPlayer';
import type { Movie, Series, SeriesEpisode } from '@/lib/schemas';
import type { SessionResponse } from '@/lib/types';

interface WatchClientProps {
  session: SessionResponse;
  type: 'movie' | 'series';
  movie?: Movie | null;
  series?: Series | null;
  initialSeason: number | null;
  initialEpisode: number | null;
}

interface EpisodeState {
  season: number;
  episode: number;
}

function findEpisode(series: Series, seasonNumber: number, episodeNumber: number): SeriesEpisode | null {
  const season = series.seasons.find((entry) => entry.season === seasonNumber);
  if (!season) {
    return null;
  }
  return season.episodes.find((ep) => ep.episode === episodeNumber) ?? null;
}

function getNextEpisode(series: Series, state: EpisodeState): EpisodeState | null {
  const season = series.seasons.find((entry) => entry.season === state.season);
  if (!season) {
    return null;
  }
  const nextEpisode = season.episodes.find((episode) => episode.episode === state.episode + 1);
  if (nextEpisode) {
    return { season: state.season, episode: nextEpisode.episode };
  }
  const nextSeason = series.seasons.find((entry) => entry.season === state.season + 1);
  if (!nextSeason || nextSeason.episodes.length === 0) {
    return null;
  }
  return { season: nextSeason.season, episode: nextSeason.episodes[0].episode };
}

export default function WatchClient({ session, type, movie, series, initialSeason, initialEpisode }: WatchClientProps) {
  const router = useRouter();
  const [episodeState, setEpisodeState] = useState<EpisodeState | null>(() =>
    type === 'series' && series && initialSeason && initialEpisode
      ? { season: initialSeason, episode: initialEpisode }
      : null
  );
  const [csrfToken, setCsrfToken] = useState(session.csrfToken);
  const lastProgressRef = useRef({ progress: 0, timestamp: 0 });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setCsrfToken(session.csrfToken);
  }, [session.csrfToken]);

  useEffect(() => {
    if (type === 'series' && series && episodeState) {
      router.replace(`/watch?type=series&slug=${series.slug}&s=${episodeState.season}&e=${episodeState.episode}`);
    } else if (type === 'movie' && movie) {
      router.replace(`/watch?type=movie&id=${movie.id}`);
    }
  }, [type, series, episodeState, router, movie]);

  const source = useMemo(() => {
    if (type === 'movie' && movie) {
      return {
        key: `movie-${movie.id}`,
        src: movie.streamUrl,
        title: movie.title,
        poster: movie.heroUrl ?? movie.posterUrl,
        subtitles: movie.subtitles
      };
    }
    if (type === 'series' && series && episodeState) {
      const episode = findEpisode(series, episodeState.season, episodeState.episode);
      if (!episode) {
        return null;
      }
      return {
        key: `series-${series.slug}-${episodeState.season}-${episodeState.episode}`,
        src: episode.streamUrl,
        title: `${series.title} S${episodeState.season}E${episodeState.episode} - ${episode.title}`,
        poster: series.heroUrl ?? series.posterUrl,
        subtitles: episode.subtitles
      };
    }
    return null;
  }, [type, movie, series, episodeState]);

  const reportView = useCallback(async () => {
    const contentId = type === 'movie' && movie ? movie.id : series?.slug;
    if (!contentId) {
      return;
    }
    await fetch('/api/metrics/views', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({ contentId, type })
    });
  }, [type, movie, series, csrfToken]);

  useEffect(() => {
    reportView().catch(() => null);
  }, [reportView]);

  const persistProgress = useCallback(
    async (progress: number, currentTime: number) => {
      const now = Date.now();
      if (now - lastProgressRef.current.timestamp < 4000 && Math.abs(progress - lastProgressRef.current.progress) < 0.05) {
        return;
      }
      lastProgressRef.current = { progress, timestamp: now };
      const payload = {
        contentId: type === 'movie' && movie ? movie.id : series?.slug ?? '',
        type,
        progress,
        lastWatched: new Date().toISOString(),
        season: type === 'series' && episodeState ? episodeState.season : undefined,
        episode: type === 'series' && episodeState ? episodeState.episode : undefined
      };
      await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify(payload)
      });
    },
    [type, movie, series, csrfToken, episodeState]
  );

  useEffect(() => {
    lastProgressRef.current = { progress: 0, timestamp: 0 };
  }, [source?.key]);

  const handleEpisodeChange = (target: EpisodeState) => {
    if (!series) return;
    const episode = findEpisode(series, target.season, target.episode);
    if (!episode) {
      return;
    }
    setEpisodeState(target);
    setIsReady(false);
  };

  const handleAutoNext = () => {
    if (type !== 'series' || !series || !episodeState) {
      return;
    }
    const nextEpisode = getNextEpisode(series, episodeState);
    if (nextEpisode) {
      handleEpisodeChange(nextEpisode);
    }
  };

  if (!source) {
    return (
      <main className="layout-container" style={{ paddingTop: '4rem' }}>
        <p>Contenu introuvable.</p>
      </main>
    );
  }

  return (
    <main className="layout-container" style={{ paddingTop: '2rem', display: 'grid', gap: '2rem' }}>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem' }}>{source.title}</h1>
        <VideoPlayer
          key={source.key}
          src={source.src}
          title={source.title}
          poster={source.poster}
          subtitles={source.subtitles}
          onProgress={(progress, currentTime) => persistProgress(progress, currentTime).catch(() => null)}
          onEnded={handleAutoNext}
          onReady={() => setIsReady(true)}
        />
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link href="/app">
            <button style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)' }}>Retour</button>
          </Link>
          {type === 'series' && series && episodeState ? (
            <button
              onClick={() => handleAutoNext()}
              style={{ background: 'var(--accent)', opacity: isReady ? 1 : 0.6 }}
              disabled={!isReady}
            >
              Épisode suivant
            </button>
          ) : null}
        </div>
      </div>
      {type === 'series' && series ? (
        <aside style={{ display: 'grid', gap: '1rem' }} aria-label="Liste des épisodes">
          {series.seasons.map((season) => (
            <div key={season.season} style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)' }}>
              <h2 style={{ marginTop: 0 }}>Saison {season.season}</h2>
              <div className="grid" style={{ gap: '0.75rem' }}>
                {season.episodes.map((episode) => (
                  <button
                    key={`${season.season}-${episode.episode}`}
                    onClick={() => handleEpisodeChange({ season: season.season, episode: episode.episode })}
                    style={{
                      justifyContent: 'flex-start',
                      display: 'flex',
                      gap: '0.75rem',
                      background:
                        episodeState?.season === season.season && episodeState.episode === episode.episode
                          ? 'var(--accent)'
                          : 'rgba(0,0,0,0.4)'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>E{episode.episode}</span>
                    <span>{episode.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
      ) : null}
    </main>
  );
}
