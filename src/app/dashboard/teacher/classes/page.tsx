'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface Class {
  id: string;
  name: string;
  level: string;
  capacity: number;
  student_count: number;
}

export default function MyClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, [user]);

  // Abonnement aux changements des classes assignées
  useRealtimeSubscription({
    table: 'teacher_classes',
    event: '*',
    filter: `teacher_id=eq.${user?.id}`,
    onData: () => {
      loadClasses();
    },
    enabled: !!user?.id,
  });

  // Abonnement aux changements des classes
  useRealtimeSubscription({
    table: 'classes',
    event: 'UPDATE',
    onData: (payload) => {
      const updatedClass = payload.new;
      setClasses(prev =>
        prev.map(cls =>
          cls.id === updatedClass.id
            ? {
                ...cls,
                name: updatedClass.name,
                level: updatedClass.level,
                capacity: updatedClass.capacity,
              }
            : cls
        )
      );
    },
    enabled: !!user?.id,
  });

  const loadClasses = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('teacher_classes')
        .select(`
          class:classes(
            id,
            name,
            level,
            capacity,
            students(id)
          )
        `)
        .eq('teacher_id', user.id);

      if (error) throw error;

      const classList: Class[] = (data || [])
        .filter((tc: any) => tc.class)
        .map((tc: any) => ({
          id: tc.class.id,
          name: tc.class.name,
          level: tc.class.level,
          capacity: tc.class.capacity,
          student_count: (tc.class.students || []).length,
        }));

      setClasses(classList);
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
        <h1 className="text-3xl font-semibold text-neutral-900">Mes classes</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Vous avez {classes.length} classe{classes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Statistiques */}
      <Card className="border border-neutral-200 p-4">
        <p className="text-xs text-neutral-600 mb-1">Nombre total d'élèves</p>
        <p className="text-3xl font-bold text-neutral-900">
          {classes.reduce((sum, c) => sum + (c.student_count || 0), 0)}
        </p>
      </Card>

      {/* Liste des classes */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : classes.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.BookOpen className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucune classe assignée</h3>
          <p className="text-sm text-neutral-600">Contactez votre directeur pour être assigné à une classe</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card key={cls.id} className="border border-neutral-200 p-6 hover:shadow-md transition-shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-neutral-900">{cls.name}</h3>
                <p className="text-sm text-neutral-600">{cls.level}</p>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Élèves:</span>
                  <span className="font-medium">{cls.student_count}/{cls.capacity}</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${((cls.student_count || 0) / cls.capacity) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => window.location.href = `/dashboard/teacher/attendance?classId=${cls.id}`}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                  Présence
                </button>
                <button 
                  onClick={() => window.location.href = `/dashboard/teacher/students?classId=${cls.id}`}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors">
                  Élèves
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
