'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {
      email: '',
      password: '',
    };
    
    if (!formData.email) {
      newErrors.email = 'L\'email est requis';
    }
    
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    }
    
    setErrors(newErrors);
    
    if (newErrors.email || newErrors.password) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await signIn(formData.email, formData.password);
      
      if (result.success && result.user) {
        // Récupérer le rôle pour cibler le bon dashboard
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', result.user.id)
          .single();

        const redirectOverride = searchParams.get('redirect');
        const dashboardRoutes: Record<string, string> = {
          SUPER_ADMIN: '/dashboard/super-admin',
          ADMIN: '/dashboard/admin',
          SECRETARY: '/dashboard/secretary',
          ACCOUNTANT: '/dashboard/accountant',
          TEACHER: '/dashboard/teacher',
          PARENT: '/dashboard/parent',
        };

        const target = redirectOverride
          || (profile?.role ? dashboardRoutes[profile.role] : undefined)
          || '/dashboard';

        toast.success('Connexion réussie');
        router.replace(target);
      } else {
        toast.error(result.error || 'Identifiants incorrects');
        setIsLoading(false);
      }
    } catch (error) {
      toast.error('Une erreur est survenue lors de la connexion');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">
          GSGA
        </h1>
        <p className="mt-2 text-neutral-600">
          Connectez-vous à votre compte
        </p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="email"
            label="Adresse email"
            placeholder="exemple@ecole.ci"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
            required
            autoComplete="email"
            autoFocus
          />

          <Input
            type="password"
            label="Mot de passe"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={errors.password}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Se connecter
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-600">
          <p>Mot de passe oublié ? Contactez votre administrateur</p>
        </div>

        {/* Lien inscription Super Admin */}
        <div className="mt-4 text-center text-sm">
          <p className="text-neutral-700">
            Pas encore de compte Super Admin ?{' '}
            <a href="/signup" className="text-primary-600 font-medium hover:underline">
              Créer un compte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
