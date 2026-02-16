'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule?: string;
  date_of_birth: string;
  gender: string;
  email: string;
  phone: string | null;
  class_id: string | null;
  class?: { name: string };
  enrollment_date: string;
}

export default function StudentsSPage() {
  const { user } = useAuth();
  const allowedRoles = ['SECRETARY', 'ADMIN', 'ACCOUNTANT'];
  const canViewDetails = allowedRoles.includes(user?.role || '');
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentParents, setStudentParents] = useState<any[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<{ totalPaid: number; count: number; lastPaymentDate: string | null }>(
    { totalPaid: 0, count: 0, lastPaymentDate: null }
  );
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);
  const [newClassId, setNewClassId] = useState('');

  // Subscription en temps réel pour les classes
  useRealtimeSubscription({
    table: 'classes',
    filter: user?.school_id ? `school_id=eq.${user.school_id}` : undefined,
    onUpdate: () => {
      loadStudents();
    }
  });

  useEffect(() => {
    loadStudents();
  }, [user]);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, students]);

  const loadStudents = async () => {
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
          .select('id, name, level')
          .eq('school_id', user.school_id)
          .is('deleted_at', null)
          .order('level, name')
      ]);

      if (studentsRes.error) throw studentsRes.error;
      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
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

    // Charger les paiements de l'élève (montant cumulé et dernier paiement)
    setIsLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalPaid = (data || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
      const lastPaymentDate = data && data[0]?.created_at ? data[0].created_at : null;

      setPaymentSummary({
        totalPaid,
        count: data?.length || 0,
        lastPaymentDate,
      });
    } catch (error) {
      console.warn('Paiements non disponibles pour cet élève', error);
      setPaymentSummary({ totalPaid: 0, count: 0, lastPaymentDate: null });
    } finally {
      setIsLoadingPayments(false);
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
      loadStudents();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    } finally {
      setIsUpdatingClass(false);
    }
  };

  const filterStudents = () => {
    const term = searchTerm.toLowerCase();
    setFilteredStudents(
      students.filter(s =>
        s.first_name?.toLowerCase().includes(term) ||
        s.last_name?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.matricule?.toLowerCase().includes(term)
      )
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Gestion des élèves</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Consultez la liste des élèves ({filteredStudents.length} au total)
        </p>
      </div>

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
                      <p className="text-xs text-neutral-500">Email</p>
                      <p className="text-sm text-neutral-900">
                        {selectedStudent.email || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Téléphone</p>
                      <p className="text-sm text-neutral-900">
                        {selectedStudent.phone || '-'}
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

                {/* Avancement des paiements */}
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-4 flex items-center gap-2">
                    <Icons.CreditCard className="w-4 h-4" />
                    Avancement des paiements
                  </h3>
                  {isLoadingPayments ? (
                    <div className="bg-neutral-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-neutral-600">Chargement des paiements...</p>
                    </div>
                  ) : paymentSummary.count === 0 ? (
                    <div className="bg-neutral-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-neutral-600">Aucun paiement enregistré</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                      <div>
                        <p className="text-xs text-neutral-500">Montant total versé</p>
                        <p className="text-lg font-semibold text-neutral-900">{paymentSummary.totalPaid.toLocaleString('fr-FR')} F</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Nombre de paiements</p>
                        <p className="text-lg font-semibold text-neutral-900">{paymentSummary.count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Dernier paiement</p>
                        <p className="text-lg font-semibold text-neutral-900">
                          {paymentSummary.lastPaymentDate
                            ? new Date(paymentSummary.lastPaymentDate).toLocaleDateString('fr-FR')
                            : '-'}
                        </p>
                      </div>
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

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="flex-1"
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Recherche */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Téléphone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Inscrit le</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-primary-600 font-medium">
                        {student.matricule || 'N/A'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">
                        {student.first_name} {student.last_name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{student.email || '-'}</td>
                    <td className="px-4 py-3 text-sm">{student.class?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{student.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(student.enrollment_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (!canViewDetails) {
                            toast.error('Accès restreint aux rôles: secrétaire, admin, comptable');
                            return;
                          }
                          handleViewDetails(student);
                        }}
                        className="text-primary-600 hover:text-primary-700 p-2 hover:bg-primary-50 rounded disabled:opacity-50"
                        disabled={!canViewDetails}
                        title={canViewDetails ? 'Voir les détails' : 'Accès restreint'}
                      >
                        <Icons.Eye className="w-4 h-4" />
                      </button>
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
