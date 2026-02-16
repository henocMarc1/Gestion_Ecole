'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// La création de compte par formulaire self-service est désactivée
// Les administrateurs créent les comptes via le super-admin panel

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers la page de connexion
    // La création de comptes est gérée par les administrateurs via le super-admin panel
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-neutral-600">Redirection...</p>
    </div>
  );
}
