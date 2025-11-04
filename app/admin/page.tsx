import { redirect } from 'next/navigation';
import { getSession, getMovies, getSeries, getCategories, getUsersList } from '@/lib/server-api';
import AdminClient from '@/components/AdminClient';
import type { Movie, Series, Category, UserRecord } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.role !== 'admin') {
    redirect('/app');
  }
  const [moviesResponse, seriesResponse, categoriesResponse, usersResponse] = await Promise.all([
    getMovies(),
    getSeries(),
    getCategories(),
    getUsersList()
  ]);

  return (
    <AdminClient
      session={session}
      movies={(moviesResponse.movies ?? []) as Movie[]}
      series={(seriesResponse.series ?? []) as Series[]}
      categories={(categoriesResponse.categories ?? []) as Category[]}
      users={usersResponse as { admins: Omit<UserRecord, 'password'>[]; users: Omit<UserRecord, 'password'>[] }}
    />
  );
}
