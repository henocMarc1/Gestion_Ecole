'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast, Toaster } from 'sonner';

// Pas de clé secrète requise - premier compte Super Admin libre

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Le nom complet est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // 1. Créer l'utilisateur dans Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        toast.error('Erreur: ' + authError.message);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('Erreur lors de la création de l\'utilisateur');
        setIsLoading(false);
        return;
      }

      // 2. Créer l'entrée SuperAdmin dans la table users
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.fullName,
        role: 'SUPER_ADMIN',
        is_active: true,
        must_change_password: false,
      });

      if (dbError) {
        toast.error('Erreur: ' + dbError.message);
        setIsLoading(false);
        return;
      }

      toast.success('✅ Compte SuperAdmin créé avec succès!');
      
      // Rediriger vers login
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      toast.error('Erreur: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white">GSGA</h1>
            <p className="mt-2 text-primary-100">
              Créer le premier compte Super Admin
            </p>
            <p className="mt-1 text-xs text-primary-200">
              Ce compte vous permettra de créer tous les autres utilisateurs
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-xl shadow-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Ex: Jean Dupont"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                    errors.fullName ? 'border-danger-500' : 'border-neutral-300'
                  }`}
                />
                {errors.fullName && (
                  <p className="text-xs text-danger-500 mt-1">{errors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="admin@ecole.ci"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                    errors.email ? 'border-danger-500' : 'border-neutral-300'
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-danger-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Mot de passe *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                    errors.password ? 'border-danger-500' : 'border-neutral-300'
                  }`}
                />
                {errors.password && (
                  <p className="text-xs text-danger-500 mt-1">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition ${
                    errors.confirmPassword
                      ? 'border-danger-500'
                      : 'border-neutral-300'
                  }`}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-danger-500 mt-1">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full mt-6"
              >
                Créer mon compte SuperAdmin
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center text-sm text-neutral-600">
              <p>
                Vous avez déjà un compte?{' '}
                <Link href="/login" className="text-primary-600 font-medium hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-white/10 backdrop-blur rounded-lg border border-white/20">
            <p className="text-xs text-white text-center">
              Après création, connectez-vous pour accéder au tableau de bord.
              Vous pourrez alors créer les comptes Directeur, Comptable, Secrétaire,
              Enseignants et Parents directement depuis l'interface.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
