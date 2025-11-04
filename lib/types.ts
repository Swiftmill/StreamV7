import type { Movie, Series, HistoryEntry, Category } from './schemas';

export type Media = Movie | Series;

export interface SessionResponse {
  user: { username: string; role: 'admin' | 'user' };
  csrfToken: string;
}

export interface MoviesResponse {
  movies: Movie[];
}

export interface SeriesResponse {
  series: Series[];
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface HistoryResponse {
  history: HistoryEntry[];
}
