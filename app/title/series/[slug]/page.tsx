import { notFound, redirect } from 'next/navigation';
import { getSession, getSerie } from '@/lib/server-api';
import Image from 'next/image';
import Link from 'next/link';

interface SeriesPageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';

export default async function SeriesDetailsPage({ params }: SeriesPageProps) {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const response = await getSerie(params.slug).catch(() => null);
  if (!response?.series) {
    notFound();
  }
  const { series } = response;

  return (
    <main className="layout-container" style={{ paddingTop: '2rem', display: 'grid', gap: '2rem' }}>
      <nav>
        <div className="logo">StreamV7</div>
        <Link href="/app">Retour</Link>
      </nav>
      <section style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3' }}>
          <Image src={series.posterUrl} alt={series.title} fill priority sizes="(max-width: 768px) 100vw, 400px" />
        </div>
        <div className="grid" style={{ gap: '1rem' }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>{series.title}</h1>
          <p style={{ color: 'var(--muted)' }}>{series.description}</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--muted)' }}>
            <span>{series.releaseYear}</span>
            <span>{series.totalSeasons} saisons</span>
            <span>{series.totalEpisodes} épisodes</span>
          </div>
          <Link href={`/watch?type=series&slug=${series.slug}&s=1&e=1`}>
            <button>Lire S1E1</button>
          </Link>
        </div>
      </section>
      <section className="grid" style={{ gap: '1.5rem' }}>
        {series.seasons.map((season) => (
          <div key={season.season} style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)' }}>
            <h2 style={{ marginTop: 0 }}>Saison {season.season}</h2>
            <div className="grid" style={{ gap: '1rem' }}>
              {season.episodes.map((episode) => (
                <div
                  key={`${season.season}-${episode.episode}`}
                  style={{ display: 'grid', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>E{episode.episode} – {episode.title}</h3>
                    <Link href={`/watch?type=series&slug=${series.slug}&s=${season.season}&e=${episode.episode}`}>
                      <button style={{ padding: '0.5rem 0.75rem' }}>Lire</button>
                    </Link>
                  </div>
                  <p style={{ color: 'var(--muted)', margin: 0 }}>{episode.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
