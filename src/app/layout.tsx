import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'GSGA - Système de Gestion Scolaire',
  description: 'Plateforme complète de gestion d\'école maternelle et primaire',
  manifest: '/manifest.json',
  themeColor: '#f0701d',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.variable}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
