import { cookies, headers } from 'next/headers';

async function baseFetch(pathname: string, init?: RequestInit) {
  const host = headers().get('host');
  if (!host) {
    throw new Error('Host manquant');
  }
  const cookieHeader = cookies()
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const response = await fetch(`http://${host}${pathname}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {})
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`Erreur API ${response.status}`);
  }
  return response.json();
}

export async function getSession() {
  try {
    return await baseFetch('/api/auth/session');
  } catch {
    return null;
  }
}

export async function getMovies() {
  return baseFetch('/api/catalog/movies');
}

export async function getMovie(id: string) {
  return baseFetch(`/api/catalog/movies/${id}`);
}

export async function getSeries() {
  return baseFetch('/api/catalog/series');
}

export async function getSerie(slug: string) {
  return baseFetch(`/api/catalog/series/${slug}`);
}

export async function getCategories() {
  return baseFetch('/api/catalog/categories');
}

export async function getHistory() {
  try {
    return await baseFetch('/api/history');
  } catch {
    return { history: [] };
  }
}

export async function getUsersList() {
  return baseFetch('/api/users');
}
