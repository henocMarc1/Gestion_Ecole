'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface Year {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export default function YearsPage() {
  const { user } = useAuth();
  const [years, setYears] = useState<Year[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    loadYears();
  }, [user]);

  // Abonnement aux changements des années scolaires
  useRealtimeSubscription({
    table: 'years',
    event: '*',
    filter: `school_id=eq.${user?.school_id}`,
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!user?.school_id,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newYear = payload.new as Year;
    const oldYear = payload.old as Year;

    switch (payload.eventType) {
      case 'INSERT':
        setYears(prev => [newYear, ...prev]);
        toast.success('Année scolaire ajoutée');
        break;
      case 'UPDATE':
        setYears(prev =>
          prev.map(y => y.id === newYear.id ? { ...y, ...newYear } : y)
        );
        toast.success('Année scolaire mise à jour');
        break;
      case 'DELETE':
        setYears(prev => prev.filter(y => y.id !== oldYear.id));
        toast.success('Année scolaire supprimée');
        break;
    }
  };

  const loadYears = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('years')
        .select('*')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setYears(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.school_id) {
      toast.error('Erreur: Vous n\'avez pas d\'école associée. Contactez le Super Admin.');
      return;
    }

    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Tous les champs sont requis');
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast.error('La date de fin doit être après la date de début');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('years').insert([{
        school_id: user.school_id,
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_current: years.length === 0,
      }]);

      if (error) throw error;
      toast.success('Année académique créée avec succès');
      setFormData({ name: '', start_date: '', end_date: '' });
      loadYears();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetCurrent = async (yearId: string) => {
    try {
      // Désactiver toutes les années courantes
      await supabase
        .from('years')
        .update({ is_current: false })
        .eq('school_id', user?.school_id);

      // Activer la nouvelle année courante
      const { error } = await supabase
        .from('years')
        .update({ is_current: true })
        .eq('id', yearId);

      if (error) throw error;
      toast.success('Année courante mise à jour');
      loadYears();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  const handleDeleteYear = async (yearId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette année académique ?')) return;
    
    try {
      const { error } = await supabase
        .from('years')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', yearId);

      if (error) throw error;
      toast.success('Année académique supprimée');
      loadYears();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Années académiques</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Gérez les années scolaires de votre établissement ({years.length} au total)
        </p>
      </div>

      {/* Formulaire de création */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Nouvelle année académique</h2>
          <form onSubmit={handleCreateYear} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                placeholder="Nom (ex: 2025-2026)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Date de début"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Date de fin"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Création...' : 'Créer l\'année académique'}
            </Button>
          </form>
        </div>
      </Card>

      {/* Liste des années */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : years.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucune année académique</h3>
          <p className="text-sm text-neutral-600">Créez la première année académique pour commencer</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {years.map((year) => (
            <Card key={year.id} className="border border-neutral-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900">{year.name}</h3>
                  {year.is_current && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700 mt-1">
                      Année courante
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteYear(year.id)}
                >
                  <Icons.Trash className="w-4 h-4 text-danger-600" />
                </Button>
              </div>
              <div className="space-y-2 text-sm text-neutral-600 mb-4">
                <div className="flex items-center gap-2">
                  <Icons.Calendar className="w-4 h-4" />
                  <span>Début : {new Date(year.start_date).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Calendar className="w-4 h-4" />
                  <span>Fin : {new Date(year.end_date).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
              {!year.is_current && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetCurrent(year.id)}
                  className="w-full"
                >
                  Définir comme année courante
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
