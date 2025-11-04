import { notFound, redirect } from 'next/navigation';
import { getSession, getMovie } from '@/lib/server-api';
import Image from 'next/image';
import Link from 'next/link';

interface MoviePageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function MovieDetailsPage({ params }: MoviePageProps) {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const response = await getMovie(params.id).catch(() => null);
  if (!response?.movie) {
    notFound();
  }
  const { movie } = response;

  return (
    <main className="layout-container" style={{ paddingTop: '2rem', display: 'grid', gap: '2rem' }}>
      <nav>
        <div className="logo">StreamV7</div>
        <Link href="/app">Retour</Link>
      </nav>
      <section style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3' }}>
          <Image src={movie.posterUrl} alt={movie.title} fill priority sizes="(max-width: 768px) 100vw, 400px" />
        </div>
        <div className="grid" style={{ gap: '1rem' }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>{movie.title}</h1>
          <p style={{ color: 'var(--muted)' }}>{movie.description}</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--muted)' }}>
            <span>{movie.releaseYear}</span>
            <span>{movie.durationMinutes} min</span>
            <span>Genres : {movie.genres.join(', ')}</span>
          </div>
          <Link href={`/watch?type=movie&id=${movie.id}`}>
            <button>Lire maintenant</button>
          </Link>
        </div>
      </section>
    </main>
  );
}
