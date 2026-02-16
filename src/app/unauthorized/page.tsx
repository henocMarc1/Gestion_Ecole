'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-danger-50 via-white to-danger-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="w-20 h-20 bg-danger-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-danger-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Accès refusé
          </h1>
          <p className="text-neutral-600">
            Vous n'avez pas les autorisations nécessaires pour accéder à cette page.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            Retour
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push('/login')}
          >
            Connexion
          </Button>
        </div>

        <p className="text-sm text-neutral-500">
          Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur.
        </p>
      </div>
    </div>
  );
}
