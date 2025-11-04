'use client';

import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
      setError(data.error ?? 'Identifiants invalides');
      setLoading(false);
      return;
    }
    window.location.href = '/app';
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid"
    >
      <label className="grid" style={{ gap: '0.5rem' }}>
        <span>Nom d&apos;utilisateur</span>
        <input
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)'
          }}
        />
      </label>
      <label className="grid" style={{ gap: '0.5rem' }}>
        <span>Mot de passe</span>
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)'
          }}
        />
      </label>
      {error ? (
        <p role="alert" style={{ color: '#ff6b6b' }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading} style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
        {loading ? 'Connexion…' : 'Se connecter'}
      </button>
    </motion.form>
  );
}
