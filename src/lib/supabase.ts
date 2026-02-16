import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase pour les composants client
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * Client Supabase avec service role (pour les API routes côté serveur uniquement)
 * NE JAMAIS utiliser côté client - Cette fonction est pour les API routes seulement
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase admin credentials not configured in server environment');
  }
  
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Helper pour gérer les erreurs Supabase
 */
export function handleSupabaseError(error: any): string {
  if (!error) return 'Une erreur inconnue est survenue';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error_description) return error.error_description;
  
  return 'Une erreur est survenue lors de l\'opération';
}

/**
 * Types pour les paramètres de requête
 */
export interface QueryParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

/**
 * Helper pour construire une requête paginée
 */
export function buildPaginatedQuery<T>(
  query: any,
  params: QueryParams = {}
) {
  const { page = 1, per_page = 10, sort_by, sort_order = 'desc', search } = params;
  
  // Pagination
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;
  
  // Tri
  if (sort_by) {
    query = query.order(sort_by, { ascending: sort_order === 'asc' });
  }
  
  // Range
  query = query.range(from, to);
  
  return query;
}
