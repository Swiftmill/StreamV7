import { redirect } from 'next/navigation';
import { getSession, getMovies, getSeries, getCategories, getHistory } from '@/lib/server-api';
import AppClient from '@/components/AppClient';
import type { Movie, Series, Category, HistoryEntry } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export default async function AppHomePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const [moviesResponse, seriesResponse, categoriesResponse, historyResponse] = await Promise.all([
    getMovies(),
    getSeries(),
    getCategories(),
    getHistory()
  ]);

  return (
    <AppClient
      session={session}
      movies={(moviesResponse.movies ?? []) as Movie[]}
      series={(seriesResponse.series ?? []) as Series[]}
      categories={(categoriesResponse.categories ?? []) as Category[]}
      history={(historyResponse.history ?? []) as HistoryEntry[]}
    />
  );
}
