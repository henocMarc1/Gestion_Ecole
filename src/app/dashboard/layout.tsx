'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, redirectToDashboard } = useAuth();
  const [isCheckingPassword, setIsCheckingPassword] = useState(true);

  useEffect(() => {
    checkPasswordChangeRequired();
  }, [isAuthenticated, user, pathname]);

  const checkPasswordChangeRequired = async () => {
    if (!isAuthenticated || !user?.id) {
      setIsCheckingPassword(false);
      return;
    }

    // Ne pas vérifier si on est déjà sur la page de changement de mot de passe
    if (pathname === '/dashboard/force-password-change') {
      setIsCheckingPassword(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('must_change_password')
        .eq('id', user.id)
        .single();

      if (!error && data?.must_change_password) {
        // Rediriger vers la page de changement de mot de passe
        router.push('/dashboard/force-password-change');
      } else {
        // Rediriger vers le bon dashboard selon le rôle si on est sur /dashboard
        if (pathname === '/dashboard') {
          redirectToDashboard();
        }
      }
    } catch (error) {
      console.error('Error checking password change required:', error);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  if (isCheckingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
