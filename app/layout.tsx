import './globals.css';
import type { ReactNode } from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StreamV7',
  description: 'Plateforme streaming cinéma et séries avec expérience Netflix-like.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  );
}
