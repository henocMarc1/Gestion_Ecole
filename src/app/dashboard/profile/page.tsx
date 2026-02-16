'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/Icons';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  school_id: string | null;
  created_at: string;
}

interface School {
  id: string;
  name: string;
  code: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  useEffect(() => {
    loadProfile();
    loadSchools();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setSelectedSchoolId(data.school_id || '');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement du profil');
    }
  };

  const loadSchools = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSchool = async () => {
    if (!profile) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ school_id: selectedSchoolId || null })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('École assignée avec succès');
      loadProfile();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        <p className="text-sm text-neutral-600 mt-3">Chargement...</p>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="p-8 text-center">
        <p className="text-neutral-600">Profil introuvable</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Mon profil</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Gérez vos informations personnelles et votre école
        </p>
      </div>

      {/* Informations personnelles */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Informations personnelles
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Prénom
              </label>
              <p className="text-neutral-900">{profile.first_name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nom
              </label>
              <p className="text-neutral-900">{profile.last_name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <p className="text-neutral-900">{profile.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Rôle
              </label>
              <p className="text-neutral-900 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                ID utilisateur
              </label>
              <div className="flex items-center gap-2">
                <code className="text-xs text-neutral-600 font-mono">{profile.id}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(profile.id);
                    toast.success('ID copié');
                  }}
                >
                  <Icons.Check className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Assignation d'école */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Building className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-neutral-900">
              École associée
            </h2>
          </div>

          {!profile.school_id && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4">
              <div className="flex gap-3">
                <Icons.AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-warning-900 mb-1">
                    Aucune école assignée
                  </h3>
                  <p className="text-sm text-warning-700">
                    Vous devez assigner une école à votre profil pour pouvoir créer des années académiques, classes, et autres données.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Sélectionner une école
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">-- Sélectionner une école --</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            </div>

            {profile.school_id && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                <p className="text-xs font-medium text-neutral-700 mb-1">
                  School ID actuel
                </p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-neutral-900 font-mono break-all">
                    {profile.school_id}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.school_id!);
                      toast.success('School ID copié');
                    }}
                  >
                    <Icons.Check className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              onClick={handleUpdateSchool}
              isLoading={isUpdating}
              disabled={!selectedSchoolId || selectedSchoolId === profile.school_id}
              className="w-full md:w-auto"
            >
              <Icons.Check className="w-4 h-4 mr-2" />
              Assigner cette école
            </Button>
          </div>
        </div>
      </Card>

      {/* Instructions pour les Super Admins */}
      {profile.role === 'SUPER_ADMIN' && (
        <Card className="border border-primary-200 bg-primary-50 shadow-sm">
          <div className="p-6">
            <div className="flex gap-3">
              <Icons.Info className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-primary-900 mb-2">
                  Instructions pour Super Admin
                </h3>
                <ol className="text-sm text-primary-800 space-y-2 list-decimal list-inside">
                  <li>Créez d'abord une école sur la page "Écoles"</li>
                  <li>Copiez l'ID de l'école (ou le code "GRU" si vous l'avez créée)</li>
                  <li>Revenez ici et sélectionnez l'école dans la liste</li>
                  <li>Cliquez sur "Assigner cette école"</li>
                  <li>Vous pourrez ensuite créer des années académiques et autres données</li>
                </ol>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
