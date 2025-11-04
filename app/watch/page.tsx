import { redirect } from 'next/navigation';
import { getSession, getMovie, getSerie } from '@/lib/server-api';
import WatchClient from '@/components/WatchClient';
import type { Movie, Series } from '@/lib/schemas';

interface WatchPageProps {
  searchParams: {
    type?: 'movie' | 'series';
    id?: string;
    slug?: string;
    s?: string;
    e?: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const contentType = searchParams.type;
  if (contentType === 'movie') {
    if (!searchParams.id) {
      redirect('/app');
    }
    const movieResponse = await getMovie(searchParams.id);
    const movie = movieResponse.movie as Movie;
    return (
      <WatchClient
        session={session}
        type="movie"
        movie={movie}
        initialSeason={null}
        initialEpisode={null}
      />
    );
  }
  if (contentType === 'series') {
    const slug = searchParams.slug;
    if (!slug) {
      redirect('/app');
    }
    const seriesResponse = await getSerie(slug);
    const series = seriesResponse.series as Series;
    const season = Number(searchParams.s ?? 1);
    const episode = Number(searchParams.e ?? 1);
    return (
      <WatchClient
        session={session}
        type="series"
        series={series}
        initialSeason={Number.isFinite(season) ? season : 1}
        initialEpisode={Number.isFinite(episode) ? episode : 1}
        movie={null}
      />
    );
  }
  redirect('/app');
}
