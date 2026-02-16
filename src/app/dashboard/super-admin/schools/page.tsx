'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/Icons';

interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des écoles');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Le code est requis';
    } else if (!/^[A-Z0-9-]+$/.test(formData.code)) {
      newErrors.code = 'Code invalide (lettres majuscules, chiffres, tirets uniquement)';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('schools').insert({
        name: formData.name,
        code: formData.code.toUpperCase(),
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Ce code d\'école existe déjà');
        } else {
          toast.error('Erreur: ' + error.message);
        }
        return;
      }

      toast.success('École créée avec succès');
      setFormData({ name: '', code: '', address: '', phone: '', email: '' });
      setShowForm(false);
      loadSchools();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSchoolStatus = async (schoolId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('schools')
        .update({ is_active: !currentStatus })
        .eq('id', schoolId);

      if (error) throw error;

      toast.success(`École ${!currentStatus ? 'activée' : 'désactivée'}`);
      loadSchools();
    } catch (error) {
      toast.error('Erreur lors de la modification');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Gestion des écoles</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Créez et gérez les écoles du système
          </p>
        </div>
        {!showForm && (
          <Button
            variant="primary"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" />
            Nouvelle école
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border border-neutral-200 shadow-sm">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Créer une école</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ name: '', code: '', address: '', phone: '', email: '' });
                  setErrors({});
                }}
              >
                <Icons.X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nom de l'école *"
                  placeholder="Ex: École Primaire Moderne"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                  required
                />

                <Input
                  label="Code unique *"
                  placeholder="Ex: EPM-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  error={errors.code}
                  required
                />

                <Input
                  label="Email"
                  type="email"
                  placeholder="contact@ecole.ci"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                />

                <Input
                  label="Téléphone"
                  placeholder="+225 27 22 45 67 89"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <Input
                label="Adresse"
                placeholder="Cocody, Abidjan, Côte d'Ivoire"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ name: '', code: '', address: '', phone: '', email: '' });
                    setErrors({});
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Créer l'école
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* Schools List */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
          <p className="text-sm text-neutral-600 mt-3">Chargement...</p>
        </Card>
      ) : schools.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Building className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucune école</h3>
          <p className="text-sm text-neutral-600 mb-4">
            Commencez par créer votre première école
          </p>
          {!showForm && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              Créer une école
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {schools.map((school) => (
            <Card key={school.id} className="border border-neutral-200 shadow-sm">
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Icons.Building className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">{school.name}</h3>
                      <p className="text-xs text-neutral-500">{school.code}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {/* ID de l'école - Important pour l'assignation */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-neutral-700 mb-1">ID de l'école</p>
                        <code className="text-xs text-neutral-900 font-mono break-all">
                          {school.id}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(school.id);
                          toast.success('ID copié dans le presse-papier');
                        }}
                        className="flex-shrink-0"
                        title="Copier l'ID"
                      >
                        <Icons.Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {school.email && (
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <Icons.Mail className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="truncate">{school.email}</span>
                    </div>
                  )}
                  {school.phone && (
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                      <Icons.Phone className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{school.phone}</span>
                    </div>
                  )}
                  {school.address && (
                    <div className="flex items-start gap-2 text-xs text-neutral-600">
                      <Icons.MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5" />
                      <span className="line-clamp-2">{school.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      school.is_active
                        ? 'bg-success-100 text-success-700'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {school.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSchoolStatus(school.id, school.is_active)}
                  >
                    {school.is_active ? 'Désactiver' : 'Activer'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
