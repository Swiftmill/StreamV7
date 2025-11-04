import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import LoginForm from '@/components/LoginForm';

async function fetchSession() {
  const cookieHeader = cookies()
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const host = headers().get('host');
  if (!host) {
    return null;
  }
  const res = await fetch(`http://${host}/api/auth/session`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: 'no-store'
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export default async function LoginPage() {
  const session = await fetchSession();
  if (session?.user) {
    redirect('/app');
  }
  return (
    <main className="layout-container" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 420, width: '100%', background: 'var(--surface)', padding: '2rem', borderRadius: 'var(--radius)' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '2rem', fontWeight: 700 }}>Connexion</h1>
        <LoginForm />
      </div>
    </main>
  );
}
