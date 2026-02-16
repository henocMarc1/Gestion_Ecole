import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-6">
        <h1 className="text-4xl font-bold text-white">
          École Management
        </h1>
        <p className="text-primary-100 text-lg">
          Système de gestion d'école maternelle et primaire
        </p>

        <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20 text-white text-sm space-y-2 text-left">
          <p className="font-semibold">Fonctionnalités clés</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Suivi des élèves et des classes</li>
            <li>Présences et cahier journal</li>
            <li>Facturation, paiements et relances</li>
            <li>Communication parents-école</li>
            <li>Rapports et indicateurs</li>
          </ul>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button variant="primary" size="lg">
              Se connecter
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="outline" size="lg" className="!text-white !border-white hover:!bg-white/10">
              Créer un compte
            </Button>
          </Link>
        </div>

        <p className="text-primary-100 text-xs">
          © 2026 École Management System. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
