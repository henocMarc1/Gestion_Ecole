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
import Link from 'next/link';
import { exportToPDFTable } from '@/utils/exportUtils';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule?: string;
  date_of_birth: string;
  gender: string;
  class_id: string | null;
  class?: { name: string };
  enrollment_date: string;
  created_at: string;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'date-enrolled'>('name-asc');
  const [classes, setClasses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentParents, setStudentParents] = useState<any[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);
  const [newClassId, setNewClassId] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'M',
    class_id: '',
    parent_first_name: '',
    parent_last_name: '',
    parent_email: '',
    parent_phone: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, students, classFilter, genderFilter, sortBy]);

  // Abonnement aux changements des élèves
  useRealtimeSubscription({
    table: 'students',
    event: '*',
    filter: `school_id=eq.${user?.school_id}`,
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!user?.school_id,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newStudent = payload.new as Student;
    const oldStudent = payload.old as Student;

    switch (payload.eventType) {
      case 'INSERT':
        setStudents(prev => [newStudent, ...prev]);
        toast.success('Nouvel élève ajouté');
        break;
      case 'UPDATE':
        setStudents(prev =>
          prev.map(s => s.id === newStudent.id ? { ...s, ...newStudent } : s)
        );
        toast.success('Élève mis à jour');
        break;
      case 'DELETE':
        setStudents(prev => prev.filter(s => s.id !== oldStudent.id));
        toast.success('Élève supprimé');
        break;
    }
  };

  const loadData = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const [studentsRes, classesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*, class:classes(name)')
          .eq('school_id', user.school_id)
          .is('deleted_at', null)
          .order('last_name'),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', user.school_id)
          .is('deleted_at', null)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (classesRes.error) throw classesRes.error;

      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportStudents = async () => {
    try {
      // Récupérer les infos de l'école
      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, address, phone')
        .eq('id', user?.school_id)
        .single();

      const headers = ['N°', 'Matricule', 'Prénom', 'Nom', 'Classe', 'Genre', 'Date de naissance', 'Date d\'inscription'];
      const rows = filteredStudents.map((s, index) => [
        String(index + 1),
        s.matricule || '-',
        s.first_name,
        s.last_name,
        s.class?.name || '-',
        s.gender === 'M' ? 'Masculin' : 'Féminin',
        s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString('fr-FR') : '-',
        s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString('fr-FR') : '-',
      ]);

      await exportToPDFTable(
        'Liste des Élèves',
        headers,
        rows,
        `eleves_${new Date().toISOString().split('T')[0]}`,
        {
          schoolName: school?.name,
          schoolLogo: school?.logo_url,
          schoolAddress: school?.address,
          schoolPhone: school?.phone,
        }
      );
      toast.success('Liste des élèves exportée en PDF');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    }
  };

  const handleExportStudentsCSV = async () => {
    try {
      const data = filteredStudents.map((s, index) => ({
        'N°': index + 1,
        'Matricule': s.matricule || '-',
        'Prénom': s.first_name,
        'Nom': s.last_name,
        'Classe': s.class?.name || '-',
        'Genre': s.gender === 'M' ? 'Masculin' : 'Féminin',
        'Date de naissance': s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString('fr-FR') : '-',
        'Date d\'inscription': s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString('fr-FR') : '-',
      }));

      // Utiliser l'API serveur pour le téléchargement Excel (plus fiable)
      const response = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: data,
          filename: `eleves_${new Date().toISOString().split('T')[0]}.xlsx`,
        })
      });

      if (!response.ok) throw new Error('Erreur téléchargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eleves_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Fichier Excel téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    }
  };

  const filterStudents = () => {
    const term = searchTerm.toLowerCase();
    let filtered = students.filter(s => {
      const matchesSearch = s.first_name.toLowerCase().includes(term) ||
        s.last_name.toLowerCase().includes(term) ||
        (s.matricule?.toLowerCase().includes(term) || false);
      const matchesClass = classFilter === 'ALL' || s.class_id === classFilter;
      const matchesGender = genderFilter === 'ALL' || s.gender === genderFilter;
      return matchesSearch && matchesClass && matchesGender;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'name-asc':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'fr-FR');
        case 'name-desc':
          return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`, 'fr-FR');
        case 'date-enrolled':
          return new Date(b.enrollment_date).getTime() - new Date(a.enrollment_date).getTime();
        default:
          return 0;
      }
    });

    setFilteredStudents(filtered);
  };

  const generateMatricule = (schoolId: string, studentName: string) => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const initials = studentName.substring(0, 3).toUpperCase();
    return `${year}-${initials}-${random}`;
  };

  const findOrCreateParent = async (parentData: any) => {
    if (!user?.school_id) return null;

    // Vérifier si le parent existe déjà par email
    if (parentData.email) {
      const { data: existingParents } = await supabase
        .from('users')
        .select('id')
        .eq('email', parentData.email)
        .eq('school_id', user.school_id)
        .eq('role', 'PARENT')
        .is('deleted_at', null);

      if (existingParents && existingParents.length > 0) {
        return { id: existingParents[0].id, isNew: false };
      }
    }

    // Sauvegarder la session actuelle de l'admin
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // Créer d'abord le compte Auth du parent
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parentData.email,
      password: 'Parent123!', // Mot de passe par défaut
      options: {
        data: {
          full_name: `${parentData.first_name} ${parentData.last_name}`,
          role: 'PARENT',
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Création du compte parent échouée');

    // Créer ensuite l'utilisateur dans la table users avec l'ID d'Auth
    const { data: newParent, error: parentError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id, // Utiliser l'ID du compte Auth
        school_id: user.school_id,
        email: parentData.email,
        full_name: `${parentData.first_name} ${parentData.last_name}`,
        phone: parentData.phone,
        role: 'PARENT',
        is_active: true,
        must_change_password: true, // Forcer le changement de mot de passe
      }])
      .select()
      .single();

    if (parentError) throw parentError;

    // Restaurer la session de l'admin
    if (currentSession) {
      await supabase.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      });
    }

    return { id: newParent.id, isNew: true };
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.date_of_birth || !formData.class_id) {
      toast.error('Le prénom, nom, date de naissance et classe sont requis');
      return;
    }

    if (!formData.parent_email || !formData.parent_first_name || !formData.parent_last_name) {
      toast.error('Les informations du parent sont requises');
      return;
    }

    setIsCreating(true);
    try {
      // Générer le matricule
      const matricule = generateMatricule(user?.school_id || '', formData.first_name);

      // Trouver ou créer le parent
      const parentResult = await findOrCreateParent({
        email: formData.parent_email,
        first_name: formData.parent_first_name,
        last_name: formData.parent_last_name,
        phone: formData.parent_phone,
      });

      if (!parentResult) {
        throw new Error('Erreur lors de la création du parent');
      }

      const parentId = parentResult.id;
      const isNewParent = parentResult.isNew;

      // Créer l'élève
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert([{
          school_id: user?.school_id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          class_id: formData.class_id,
          matricule: matricule,
          enrollment_date: new Date().toISOString().split('T')[0],
        }])
        .select()
        .single();

      if (studentError) throw studentError;

      // Créer la relation parent-élève
      const { error: linkError } = await supabase
        .from('parents_students')
        .insert([{
          parent_id: parentId,
          student_id: newStudent.id,
          relationship: 'Tuteur', // Valeur par défaut
          is_primary_contact: true,
        }]);

      if (linkError) throw linkError;

      if (isNewParent) {
        toast.success(
          `Élève créé avec succès! Matricule: ${matricule}\n\nCompte parent créé:\nEmail: ${formData.parent_email}\nMot de passe: Parent123!\n(Le parent devra changer ce mot de passe à la première connexion)`,
          { duration: 10000 }
        );
      } else {
        toast.success(`Élève créé avec succès! Matricule: ${matricule}`);
      }
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: 'M',
        class_id: '',
        parent_first_name: '',
        parent_last_name: '',
        parent_email: '',
        parent_phone: '',
      });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet élève ?')) return;
    
    try {
      const { error } = await supabase
        .from('students')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', studentId);

      if (error) throw error;
      toast.success('Élève supprimé');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const handleViewDetails = async (student: Student) => {
    setSelectedStudent(student);
    setNewClassId(student.class_id || '');
    setIsDetailsModalOpen(true);
    
    // Charger les parents de l'élève
    setIsLoadingParents(true);
    try {
      const { data, error } = await supabase
        .from('parents_students')
        .select('relationship, is_primary_contact, users!parents_students_parent_id_fkey(id, full_name, email, phone)')
        .eq('student_id', student.id);

      if (error) throw error;
      setStudentParents(data || []);
    } catch (error) {
      console.error('Error loading parents:', error);
      setStudentParents([]);
    } finally {
      setIsLoadingParents(false);
    }
  };

  const handleUpdateClass = async () => {
    if (!selectedStudent || !newClassId) {
      toast.error('Veuillez sélectionner une classe');
      return;
    }

    setIsUpdatingClass(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_id: newClassId })
        .eq('id', selectedStudent.id);

      if (error) throw error;
      
      toast.success('Classe mise à jour avec succès');
      setIsDetailsModalOpen(false);
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setIsUpdatingClass(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Gestion des élèves</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Créez et gérez les dossiers des élèves ({filteredStudents.length} au total)
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportStudents}>
            <Icons.Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleExportStudentsCSV}>
            <Icons.Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Icons.Plus className="w-4 h-4" />
            Ajouter un élève
          </Button>
        </div>
      </div>

      {/* Modal de création */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">Nouvel élève</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateStudent} className="space-y-6">
                {/* Informations de l'élève */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-3">Informations de l'élève</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Prénom *"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Nom de famille *"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Date de naissance *"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      required
                    />
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 md:col-span-2"
                      required
                    >
                      <option value="">Sélectionner une classe *</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Informations du parent */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-3">Informations du parent/tuteur</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Prénom du parent *"
                      value={formData.parent_first_name}
                      onChange={(e) => setFormData({ ...formData, parent_first_name: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Nom du parent *"
                      value={formData.parent_last_name}
                      onChange={(e) => setFormData({ ...formData, parent_last_name: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Email du parent *"
                      type="email"
                      value={formData.parent_email}
                      onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Téléphone du parent"
                      type="tel"
                      value={formData.parent_phone}
                      onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Si le parent existe déjà avec cet email, il sera automatiquement lié. Sinon, un nouveau compte sera créé.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" disabled={isCreating} className="flex-1">
                    {isCreating ? 'Création...' : 'Créer l\'élève'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de détails */}
      {isDetailsModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-neutral-900">Détails de l'élève</h2>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Informations générales */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-4 flex items-center gap-2">
                    <Icons.Student className="w-4 h-4" />
                    Informations générales
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-neutral-500">Matricule</p>
                      <p className="font-mono text-sm font-medium text-primary-600">
                        {selectedStudent.matricule || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Nom complet</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {selectedStudent.first_name} {selectedStudent.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Date de naissance</p>
                      <p className="text-sm text-neutral-900">
                        {new Date(selectedStudent.date_of_birth).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Genre</p>
                      <p className="text-sm text-neutral-900">
                        {selectedStudent.gender === 'M' ? 'Masculin' : 'Féminin'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Date d'inscription</p>
                      <p className="text-sm text-neutral-900">
                        {new Date(selectedStudent.enrollment_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Classe actuelle</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {selectedStudent.class?.name || 'Non assigné'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informations des parents */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-4 flex items-center gap-2">
                    <Icons.Users className="w-4 h-4" />
                    Parents / Tuteurs
                  </h3>
                  {isLoadingParents ? (
                    <div className="bg-neutral-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-neutral-600">Chargement...</p>
                    </div>
                  ) : studentParents.length === 0 ? (
                    <div className="bg-neutral-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-neutral-600">Aucun parent enregistré</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {studentParents.map((parent, idx) => (
                        <div key={idx} className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-neutral-900">
                                {parent.users?.full_name || 'N/A'}
                              </p>
                              <p className="text-xs text-neutral-500 capitalize">
                                {parent.relationship || 'Tuteur'}
                              </p>
                            </div>
                            {parent.is_primary_contact && (
                              <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
                                Contact principal
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <div>
                              <p className="text-xs text-neutral-500">Email</p>
                              <p className="text-sm text-neutral-900">
                                {parent.users?.email || '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500">Téléphone</p>
                              <p className="text-sm text-neutral-900">
                                {parent.users?.phone || '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Changement de classe */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-4 flex items-center gap-2">
                    <Icons.BookOpen className="w-4 h-4" />
                    Assigner à une classe
                  </h3>
                  <div className="bg-primary-50 border border-primary-200 p-4 rounded-lg space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Sélectionner une nouvelle classe
                      </label>
                      <select
                        value={newClassId}
                        onChange={(e) => setNewClassId(e.target.value)}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">-- Aucune classe --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={handleUpdateClass}
                      disabled={isUpdatingClass || newClassId === selectedStudent.class_id}
                      className="w-full"
                    >
                      {isUpdatingClass ? 'Mise à jour...' : 'Mettre à jour la classe'}
                    </Button>
                    {newClassId === selectedStudent.class_id && (
                      <p className="text-xs text-neutral-600 text-center">
                        L'élève est déjà dans cette classe
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions supplémentaires */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="flex-1"
                  >
                    Fermer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleDeleteStudent(selectedStudent.id);
                    }}
                    className="text-danger-600 hover:bg-danger-50"
                  >
                    <Icons.Trash className="w-4 h-4 mr-2" />
                    Supprimer l'élève
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filtres et Recherche */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Chercher par nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">Toutes les classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
          
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">Tous les genres</option>
            <option value="M">Garçons</option>
            <option value="F">Filles</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="name-asc">Nom (A → Z)</option>
            <option value="name-desc">Nom (Z → A)</option>
            <option value="date-enrolled">Plus récents</option>
          </select>
        </div>
      </Card>

      {/* Liste */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Student className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun élève</h3>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Matricule</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Nom complet</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Date de naissance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Genre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Inscrit le</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm font-mono text-neutral-700">
                      {student.matricule || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-800">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/admin/students/${student.id}`}
                          className="px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors inline-flex items-center gap-2"
                        >
                          <Icons.Eye className="w-4 h-4" />
                          Détails
                        </Link>
                        <p className="font-medium text-neutral-900">
                          {student.first_name} {student.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(student.date_of_birth).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm">{student.gender === 'M' ? 'Masculin' : 'Féminin'}</td>
                    <td className="px-4 py-3 text-sm">{student.class?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(student.enrollment_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(student)}
                        >
                          <Icons.Eye className="w-4 h-4 text-primary-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Icons.Trash className="w-4 h-4 text-danger-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
