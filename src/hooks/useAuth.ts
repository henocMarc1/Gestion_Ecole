'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthUser, AuthState } from '@/types';

/**
 * Hook personnalisé pour gérer l'authentification
 */
export function useAuth() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Récupérer la session initiale sans redirection pour éviter les boucles
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user.id, false);
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    // Écouter les changements d'auth et ne rediriger qu'au sign-in
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ne logger que les événements importants
      if (event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') {
        console.log('Auth state change:', event);
      }
      
      if (session?.user) {
        const isOnLogin =
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/login');
        const shouldRedirect = event === 'SIGNED_IN' && isOnLogin;
        loadUserProfile(session.user.id, shouldRedirect);
      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        router.push('/login');
      }
    });

    const refreshSession = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('Session refresh failed:', error.message);
          return;
        }
        if (data?.session?.user) {
          loadUserProfile(data.session.user.id, false);
        }
      } catch (error: any) {
        console.warn('Session refresh error:', error?.message || error);
      }
    };

    const refreshInterval = setInterval(refreshSession, 4 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Charger le profil complet de l'utilisateur
   */
  async function loadUserProfile(userId: string, shouldRedirect = false) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id,email,full_name,phone,role,school_id,is_active,last_login_at,created_at,updated_at,deleted_at,school:schools(*)')
        .eq('id', userId);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.warn('User profile not found, retrying in 1s...');
        // Retry après 1 seconde si l'utilisateur vient d'être créé
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: retryData, error: retryError } = await supabase
          .from('users')
          .select('id,email,full_name,phone,role,school_id,is_active,last_login_at,created_at,updated_at,deleted_at,school:schools(*)')
          .eq('id', userId);
        
        if (retryError) throw retryError;
        if (!retryData || retryData.length === 0) {
          throw new Error('User profile not found after retry');
        }
        
        const userData = retryData[0];
        
        setAuthState({
          user: userData as unknown as AuthUser,
          isLoading: false,
          isAuthenticated: true,
        });
        
        if (shouldRedirect) {
          router.replace(resolveDashboardRoute(userData.role));
        }
        
        return;
      }
      
      const userData = data[0];

      setAuthState({
        user: userData as unknown as AuthUser,
        isLoading: false,
        isAuthenticated: true,
      });

      if (shouldRedirect) {
        router.replace(resolveDashboardRoute(userData.role));
      }

      // Mettre à jour last_login_at
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setAuthState((prev) => {
        if (prev.isAuthenticated && prev.user) {
          return { ...prev, isLoading: false };
        }
        return {
          user: null,
          isLoading: false,
          isAuthenticated: false,
        };
      });
    }
  }

  /**
   * Connexion
   */
  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Déconnexion
   */
  async function signOut() {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  /**
   * Redirection vers le dashboard approprié selon le rôle
   */
  function resolveDashboardRoute(role?: string | null) {
    const dashboardRoutes: Record<string, string> = {
      SUPER_ADMIN: '/dashboard/super-admin',
      ADMIN: '/dashboard/admin',
      HR: '/dashboard/hr',
      SECRETARY: '/dashboard/secretary',
      ACCOUNTANT: '/dashboard/accountant',
      TEACHER: '/dashboard/teacher',
      PARENT: '/dashboard/parent',
    };

    return (role && dashboardRoutes[role]) || '/dashboard';
  }

  function redirectToDashboard() {
    if (!authState.user) {
      router.push('/login');
      return;
    }

    router.push(resolveDashboardRoute(authState.user.role));
  }

  /**
   * Vérifier si l'utilisateur a un rôle spécifique
   */
  function hasRole(role: string | string[]): boolean {
    if (!authState.user) return false;
    
    if (Array.isArray(role)) {
      return role.includes(authState.user.role);
    }
    
    return authState.user.role === role;
  }

  /**
   * Vérifier si l'utilisateur est admin
   */
  function isAdmin(): boolean {
    return hasRole(['SUPER_ADMIN', 'ADMIN']);
  }

  return {
    ...authState,
    signIn,
    signOut,
    redirectToDashboard,
    hasRole,
    isAdmin,
    refetch: () => authState.user && loadUserProfile(authState.user.id),
  };
}
