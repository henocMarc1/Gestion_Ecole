'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';

interface Document {
  id: string;
  title: string;
  description: string;
  file_url: string;
  category: string;
  student_id?: string;
  created_at: string;
  student?: { first_name: string; last_name: string };
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
  });

  useEffect(() => {
    loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*, student:students(first_name, last_name)')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Le titre est requis');
      return;
    }

    setIsUploading(true);
    try {
      // Note: Upload réel nécessiterait une implémentation de file upload
      const { error } = await supabase.from('documents').insert([{
        school_id: user?.school_id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        file_url: '#',
      }]);

      if (error) throw error;
      toast.success('Document ajouté avec succès');
      setFormData({ title: '', description: '', category: 'GENERAL' });
      loadDocuments();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', docId);

      if (error) throw error;
      toast.success('Document supprimé');
      loadDocuments();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Gestion des documents</h1>
        <p className="text-sm text-neutral-600 mt-1">Organisez et archivez les documents administratifs</p>
      </div>

      {/* Formulaire d'ajout */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Ajouter un document</h2>
          <form onSubmit={handleUploadDocument} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Titre du document"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="GENERAL">Général</option>
                <option value="ADMINISTRATIVE">Administrative</option>
                <option value="FINANCIAL">Financière</option>
                <option value="ACADEMIC">Académique</option>
              </select>
            </div>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Ajout en cours...' : 'Ajouter le document'}
            </Button>
          </form>
        </div>
      </Card>

      {/* Liste des documents */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.FileText className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun document</h3>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border border-neutral-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Icons.FileText className="w-6 h-6 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900">{doc.title}</h3>
                    {doc.description && (
                      <p className="text-sm text-neutral-600 mt-1">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-neutral-100">
                        {doc.category}
                      </span>
                      <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDocument(doc.id)}
                >
                  <Icons.Trash className="w-4 h-4 text-danger-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
