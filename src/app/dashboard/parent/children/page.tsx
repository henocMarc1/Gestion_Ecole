'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  class?: { name: string };
  enrollment_date: string;
}

export default function MyChildrenPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChildren();
  }, [user]);

  const loadChildren = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('parents_students')
        .select('student:students(id, first_name, last_name, enrollment_date, class:classes(name))')
        .eq('parent_id', user.id);

      if (error) throw error;
      const students = (data || [])
        .map((ps: any) => ps.student)
        .filter(Boolean) as Child[];
      setChildren(students);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Mes enfants</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Vous suivez {children.length} enfant{children.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Liste des enfants */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : children.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Users className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun enfant</h3>
          <p className="text-sm text-neutral-600">Contactez l'école pour ajouter votre enfant</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => (
            <Card key={child.id} className="border border-neutral-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-700">
                    {child.first_name.charAt(0)}{child.last_name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900">
                    {child.first_name} {child.last_name}
                  </h3>
                  <p className="text-sm text-neutral-600">{child.class?.name || 'Non classé'}</p>
                </div>
              </div>

              <div className="mb-4 text-sm text-neutral-600">
                <p>
                  Inscrit le{' '}
                  {new Date(child.enrollment_date).toLocaleDateString('fr-FR')}
                </p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => window.location.href = `/dashboard/parent/children/${child.id}`}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                  Fiche
                </button>
                <button 
                  onClick={() => window.location.href = `/dashboard/parent/invoices?studentId=${child.id}`}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors">
                  Factures
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
