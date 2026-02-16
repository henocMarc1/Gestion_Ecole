'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { notifyNewClass, notifyClassModified } from '@/lib/notificationHelpers';
import { toast } from 'sonner';

interface Class {
  id: string;
  name: string;
  level: string;
  capacity: number;
  student_count?: number;
  teacher_count?: number;
  created_at: string;
}

interface PaymentSchedule {
  installment_number: number;
  due_month: number;
  amount: number;
  description?: string;
}

interface TuitionFeeData {
  totalAmount: number;
  registrationFee: number;
  otherFees: number;
  schedules: PaymentSchedule[];
}

export default function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [years, setYears] = useState<any[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: '', level: '', capacity: 30, year_id: '', teacher_id: '', payment_due_day: 5 });
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'students' | 'teachers' | 'fees'>('overview');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [assignedTeachers, setAssignedTeachers] = useState<any[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [currentYear, setCurrentYear] = useState<any>(null);
  const [tuitionFeeData, setTuitionFeeData] = useState<TuitionFeeData>({
    totalAmount: 0,
    registrationFee: 0,
    otherFees: 0,
    schedules: []
  });
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: Info classe, 2: Frais de scolarité

  useEffect(() => {
    loadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClass && modalTab === 'fees') {
      loadClassTuitionFees(selectedClass.id);
    }
  }, [selectedClass, modalTab]);

  useRealtimeSubscription({
    table: 'classes',
    event: '*',
    filter: `school_id=eq.${user?.school_id}`,
    onData: (payload) => {
      handleRealtimeClassUpdate(payload);
    },
    enabled: !!user?.school_id,
  });

  useRealtimeSubscription({
    table: 'teacher_classes',
    event: '*',
    onData: () => {
      loadClasses();
    },
    enabled: !!user?.school_id,
  });

  const handleRealtimeClassUpdate = (payload: RealtimePayload) => {
    const newClass = payload.new;
    const oldClass = payload.old;

    switch (payload.eventType) {
      case 'INSERT':
        setClasses(prev => [
          ...prev,
          {
            id: newClass.id,
            name: newClass.name,
            level: newClass.level,
            capacity: newClass.capacity,
            student_count: 0,
            teacher_count: 0,
            created_at: newClass.created_at,
          }
        ]);
        toast.success('Nouvelle classe ajoutée');
        break;

      case 'UPDATE':
        setClasses(prev =>
          prev.map(cls =>
            cls.id === newClass.id
              ? {
                  ...cls,
                  name: newClass.name,
                  level: newClass.level,
                  capacity: newClass.capacity,
                }
              : cls
          )
        );
        toast.success('Classe mise à jour');
        break;

      case 'DELETE':
        setClasses(prev => prev.filter(cls => cls.id !== oldClass.id));
        if (selectedClass?.id === oldClass.id) {
          setSelectedClass(null);
        }
        toast.success('Classe supprimée');
        break;
    }
  };

  const loadClasses = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const [classesRes, yearsRes, teachersRes] = await Promise.all([
        supabase
          .from('classes')
          .select(`
            *,
            students(id),
            teacher_classes(id),
            year:years(name)
          `)
          .eq('school_id', user.school_id)
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('years')
          .select('id, name')
          .eq('school_id', user.school_id)
          .is('deleted_at', null),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('school_id', user.school_id)
          .eq('role', 'TEACHER')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('full_name')
      ]);

      if (classesRes.error) throw classesRes.error;
      if (yearsRes.error) throw yearsRes.error;
      if (teachersRes.error) throw teachersRes.error;
      
      const classList = (classesRes.data || []).map((cls: any) => ({
        id: cls.id,
        name: cls.name,
        level: cls.level,
        capacity: cls.capacity,
        student_count: cls.students?.length || 0,
        teacher_count: cls.teacher_classes?.length || 0,
        created_at: cls.created_at,
      }));

      setClasses(classList);
      setYears(yearsRes.data || []);
      setAvailableTeachers(teachersRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des classes');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.level || !formData.year_id) {
      toast.error('Tous les champs sont requis');
      return;
    }

    // Passer à l'étape 2 pour définir les frais
    setCreateStep(2);
  };

  const handleCompleteClassCreation = async () => {
    // Validation des échéanciers
    if (tuitionFeeData.schedules.length === 0) {
      toast.error('Vous devez définir au moins un échéancier de paiement');
      return;
    }

    if (tuitionFeeData.totalAmount <= 0) {
      toast.error('Le montant total doit être supérieur à 0');
      return;
    }

    if (tuitionFeeData.registrationFee <= 0) {
      toast.error('Les frais d\'inscription doivent être supérieurs à 0');
      return;
    }

    setIsCreating(true);
    try {
      // 1. Créer la classe
      const { data: newClass, error: classError } = await supabase
        .from('classes')
        .insert([{
          school_id: user?.school_id,
          name: formData.name,
          level: formData.level,
          capacity: formData.capacity,
          year_id: formData.year_id,
          payment_due_day: formData.payment_due_day,
        }])
        .select()
        .single();

      if (classError) throw classError;

      // 2. Assigner l'enseignant si sélectionné
      if (formData.teacher_id && newClass) {
        const { error: assignError } = await supabase
          .from('teacher_classes')
          .insert([{
            teacher_id: formData.teacher_id,
            class_id: newClass.id,
            is_main_teacher: true,
          }]);

        if (assignError) {
          console.error('Erreur assignation enseignant:', assignError);
        }
      }

      // Notify teacher about class assignment
      if (formData.teacher_id && newClass && user?.school_id) {
        try {
          await notifyNewClass(
            user.school_id,
            formData.name,
            newClass.id,
            [formData.teacher_id]
          );
        } catch (notifError) {
          console.warn('Avertissement - Notification non créée:', notifError);
        }
      }

      // 3. Créer les frais de scolarité
      const { data: tuitionFee, error: feeError } = await supabase
        .from('tuition_fees')
        .insert({
          school_id: user?.school_id,
          class_id: newClass.id,
          total_amount: tuitionFeeData.totalAmount,
          registration_fee: tuitionFeeData.registrationFee,
          other_fees: tuitionFeeData.otherFees,
          academic_year: currentYear?.name || new Date().getFullYear().toString(),
        })
        .select()
        .single();

      if (feeError) throw feeError;

      // 4. Créer les échéanciers
      const schedulesToInsert = tuitionFeeData.schedules.map(schedule => ({
        tuition_fee_id: tuitionFee.id,
        installment_number: schedule.installment_number,
        due_month: schedule.due_month,
        amount: schedule.amount,
        description: schedule.description || `Tranche ${schedule.installment_number}`,
      }));

      const { error: schedulesError } = await supabase
        .from('payment_schedules')
        .insert(schedulesToInsert);

      if (schedulesError) throw schedulesError;

      toast.success('Classe créée avec succès avec les échéanciers de paiement !');
      
      // Réinitialiser le formulaire
      setFormData({ name: '', level: '', capacity: 30, year_id: '', teacher_id: '', payment_due_day: 5 });
      setTuitionFeeData({
        totalAmount: 0,
        registrationFee: 0,
        otherFees: 0,
        schedules: []
      });
      setShowCreateModal(false);
      setCreateStep(1);
      loadClasses();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) return;
    
    try {
      const { error } = await supabase
        .from('classes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', classId);

      if (error) throw error;
      toast.success('Classe supprimée');
      loadClasses();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const loadClassTuitionFees = async (classId: string) => {
    try {
      const { data: fees, error } = await supabase
        .from('tuition_fees')
        .select('*')
        .eq('class_id', classId)
        .eq('school_id', user?.school_id)
        .order('academic_year', { ascending: false })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (fees) {
        const { data: schedules } = await supabase
          .from('payment_schedules')
          .select('*')
          .eq('tuition_fee_id', fees.id)
          .order('installment_number');

        setTuitionFeeData({
          totalAmount: fees.total_amount,
          registrationFee: fees.registration_fee,
          otherFees: fees.other_fees,
          schedules: (schedules || [])
        });
      } else {
        // Générer les mois en fonction de l'année académique
        const monthSchedules = generateMonthSchedules(currentYear);
        setTuitionFeeData({
          totalAmount: 0,
          registrationFee: 0,
          otherFees: 0,
          schedules: monthSchedules
        });
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    }
  };

  const generateMonthSchedules = (year: any): PaymentSchedule[] => {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    // Tableau par défaut (Septembre à Juin)
    const defaultMonths = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

    let availableMonths = defaultMonths;

    if (year?.start_date && year?.end_date) {
      const startDate = new Date(year.start_date);
      const endDate = new Date(year.end_date);
      availableMonths = [];
      
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthNum = currentDate.getMonth() + 1; // 1-12
        if (!availableMonths.includes(monthNum)) {
          availableMonths.push(monthNum);
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Ne générer que 4 versements par défaut, l'admin peut ajouter/modifier
    const defaultScheduleMonths = availableMonths.slice(0, 4);
    
    return defaultScheduleMonths.map((monthNum, idx) => ({
      installment_number: idx + 1,
      due_month: monthNum,
      amount: 0,
      description: `Versement ${idx + 1} (${monthNames[monthNum - 1]})`
    }));
  };
  
  const getAvailableMonthsForYear = (year: any): number[] => {
    const defaultMonths = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

    if (!year?.start_date || !year?.end_date) {
      return defaultMonths;
    }

    const startDate = new Date(year.start_date);
    const endDate = new Date(year.end_date);
    const availableMonths: number[] = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthNum = currentDate.getMonth() + 1;
      if (!availableMonths.includes(monthNum)) {
        availableMonths.push(monthNum);
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return availableMonths;
  };

  const calculateEvenDistribution = (total: number, monthCount: number) => {
    if (monthCount === 0 || total === 0) return 0;
    return Math.floor(total / monthCount);
  };

  const handleSaveTuitionFees = async () => {
    if (!selectedClass || !currentYear) {
      toast.error('Classe ou année académique manquante');
      return;
    }

    if (tuitionFeeData.totalAmount <= 0) {
      toast.error('Le montant total doit être supérieur à 0');
      return;
    }

    setIsSavingFees(true);
    try {
      const { data: existingFees } = await supabase
        .from('tuition_fees')
        .select('id')
        .eq('class_id', selectedClass.id)
        .eq('school_id', user?.school_id)
        .maybeSingle();

      let feeId: string;

      if (existingFees) {
        const { data: updated, error } = await supabase
          .from('tuition_fees')
          .update({
            total_amount: tuitionFeeData.totalAmount,
            registration_fee: tuitionFeeData.registrationFee,
            other_fees: tuitionFeeData.otherFees,
            academic_year: currentYear.name
          })
          .eq('id', existingFees.id)
          .select()
          .single();

        if (error) throw error;
        feeId = updated.id;

        await supabase
          .from('payment_schedules')
          .delete()
          .eq('tuition_fee_id', feeId);
      } else {
        const { data: newFee, error } = await supabase
          .from('tuition_fees')
          .insert([{
            school_id: user?.school_id,
            class_id: selectedClass.id,
            total_amount: tuitionFeeData.totalAmount,
            registration_fee: tuitionFeeData.registrationFee,
            other_fees: tuitionFeeData.otherFees,
            academic_year: currentYear.name
          }])
          .select()
          .single();

        if (error) throw error;
        feeId = newFee.id;
      }

      const schedulesToInsert = tuitionFeeData.schedules.map((schedule) => ({
        tuition_fee_id: feeId,
        installment_number: schedule.installment_number,
        due_month: schedule.due_month,
        amount: schedule.amount,
        description: schedule.description || `Versement ${schedule.installment_number}`
      }));

      const { error: scheduleError } = await supabase
        .from('payment_schedules')
        .insert(schedulesToInsert);

      if (scheduleError) throw scheduleError;

      toast.success('Frais de scolarité sauvegardés');
      loadClassTuitionFees(selectedClass.id);
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    } finally {
      setIsSavingFees(false);
    }
  };

  const loadTeachers = async (classId: string) => {
    if (!user?.school_id) return;
    setIsLoadingTeachers(true);
    try {
      const { data: allTeachers, error: teachersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('school_id', user.school_id)
        .eq('role', 'TEACHER')
        .is('deleted_at', null);

      if (teachersError) throw teachersError;

      const { data: assignments, error: assignError } = await supabase
        .from('teacher_classes')
        .select(`
          id,
          teacher_id,
          teacher:users(id, full_name, email)
        `)
        .eq('class_id', classId);

      if (assignError) throw assignError;

      setTeachers(allTeachers || []);
      setAssignedTeachers(assignments || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des enseignants');
      console.error(error);
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  const handleAssignTeacher = async (teacherId: string) => {
    if (!selectedClass) return;
    
    try {
      const { error } = await supabase
        .from('teacher_classes')
        .insert([{
          teacher_id: teacherId,
          class_id: selectedClass.id,
        }]);

      if (error) throw error;
      toast.success('Enseignant assigné avec succès');
      loadTeachers(selectedClass.id);
      loadClasses();
    } catch (error) {
      toast.error('Erreur lors de l\'assignation');
      console.error(error);
    }
  };

  const handleUnassignTeacher = async (assignmentId: string) => {
    if (!selectedClass) return;
    
    try {
      const { error } = await supabase
        .from('teacher_classes')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success('Enseignant retiré avec succès');
      loadTeachers(selectedClass.id);
      loadClasses();
    } catch (error) {
      toast.error('Erreur lors du retrait');
      console.error(error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Gestion des classes</h1>
        <p className="text-sm text-neutral-600 mt-1">Créez et gérez les classes de votre école</p>
      </div>

      {selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-900">{selectedClass.name}</h2>
                  <p className="text-sm text-neutral-600">Niveau: {selectedClass.level}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClass(null);
                    setModalTab('overview');
                  }}
                >
                  <Icons.X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex gap-2 mb-6 border-b border-neutral-200 overflow-x-auto">
                <button
                  onClick={() => setModalTab('overview')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
                    modalTab === 'overview'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Icons.Home className="w-4 h-4 inline mr-2" />
                  Vue d'ensemble
                </button>
                <button
                  onClick={() => setModalTab('students')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
                    modalTab === 'students'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Icons.Users className="w-4 h-4 inline mr-2" />
                  Élèves
                </button>
                <button
                  onClick={() => {
                    setModalTab('teachers');
                    loadTeachers(selectedClass.id);
                  }}
                  className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
                    modalTab === 'teachers'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Icons.BookOpen className="w-4 h-4 inline mr-2" />
                  Enseignants
                </button>
                <button
                  onClick={() => setModalTab('fees')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
                    modalTab === 'fees'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Icons.DollarSign className="w-4 h-4 inline mr-2" />
                  Frais
                </button>
              </div>

              {modalTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-neutral-50 rounded-lg">
                      <p className="text-sm text-neutral-600 mb-1">Capacité</p>
                      <p className="text-2xl font-semibold text-neutral-900">{selectedClass.capacity}</p>
                    </div>
                    <div className="p-4 bg-primary-50 rounded-lg">
                      <p className="text-sm text-neutral-600 mb-1">Élèves</p>
                      <p className="text-2xl font-semibold text-primary-600">{selectedClass.student_count || 0}</p>
                    </div>
                    <div className="p-4 bg-secondary-50 rounded-lg">
                      <p className="text-sm text-neutral-600 mb-1">Enseignants</p>
                      <p className="text-2xl font-semibold text-secondary-600">{selectedClass.teacher_count || 0}</p>
                    </div>
                  </div>
                  <Button variant="primary" className="w-full" onClick={() => setModalTab('fees')}>
                    <Icons.DollarSign className="w-4 h-4 mr-2" />
                    Définir les frais de scolarité
                  </Button>
                </div>
              )}

              {modalTab === 'students' && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Gérez les élèves de cette classe depuis la page de gestion des élèves.
                  </p>
                  <Button 
                    variant="primary"
                    onClick={() => window.location.href = `/dashboard/admin/students?classId=${selectedClass.id}`}
                  >
                    <Icons.Users className="w-4 h-4 mr-2" />
                    Gérer les élèves
                  </Button>
                </div>
              )}

              {modalTab === 'teachers' && (
                <div className="space-y-6">
                  {isLoadingTeachers ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                          Enseignants assignés ({assignedTeachers.length})
                        </h3>
                        {assignedTeachers.length === 0 ? (
                          <div className="text-center py-8 bg-neutral-50 rounded-lg border border-dashed border-neutral-300">
                            <Icons.BookOpen className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                            <p className="text-sm text-neutral-600">Aucun enseignant</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {assignedTeachers.map((assignment: any) => (
                              <div
                                key={assignment.id}
                                className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium text-neutral-900">
                                    {assignment.teacher?.full_name}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnassignTeacher(assignment.id)}
                                >
                                  <Icons.Trash className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Ajouter</h3>
                        <div className="space-y-2">
                          {teachers
                            .filter(
                              (t: any) => !assignedTeachers.find((a: any) => a.teacher_id === t.id)
                            )
                            .slice(0, 5)
                            .map((teacher: any) => (
                              <div
                                key={teacher.id}
                                className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-lg"
                              >
                                <p className="font-medium text-neutral-900">
                                  {teacher.full_name}
                                </p>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAssignTeacher(teacher.id)}
                                >
                                  <Icons.Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {modalTab === 'fees' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-900">
                      Année académique
                    </label>
                    <select
                      value={currentYear?.id || ''}
                      onChange={(e) => {
                        const year = years.find(y => y.id === e.target.value);
                        setCurrentYear(year);
                        if (year) {
                          const monthSchedules = generateMonthSchedules(year);
                          setTuitionFeeData({
                            ...tuitionFeeData,
                            schedules: monthSchedules
                          });
                        }
                      }}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                    >
                      <option value="">Sélectionner...</option>
                      {years.map(year => (
                        <option key={year.id} value={year.id}>
                          {year.name} 
                          {year.start_date && year.end_date && 
                            ` (${new Date(year.start_date).toLocaleDateString('fr-FR')} - ${new Date(year.end_date).toLocaleDateString('fr-FR')})`
                          }
                        </option>
                      ))}
                    </select>
                    {currentYear && currentYear.start_date && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                        <p className="text-blue-900">
                          <strong>Période:</strong> {new Date(currentYear.start_date).toLocaleDateString('fr-FR')} 
                          {' '}-{' '}
                          {new Date(currentYear.end_date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-blue-800 mt-1">
                          <strong>Nombre de mois:</strong> {tuitionFeeData.schedules.length}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Total (XOF)</label>
                      <input
                        type="number"
                        value={tuitionFeeData.totalAmount}
                        onChange={(e) => setTuitionFeeData({
                          ...tuitionFeeData,
                          totalAmount: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Inscription</label>
                      <input
                        type="number"
                        value={tuitionFeeData.registrationFee}
                        onChange={(e) => setTuitionFeeData({
                          ...tuitionFeeData,
                          registrationFee: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Autres</label>
                      <input
                        type="number"
                        value={tuitionFeeData.otherFees}
                        onChange={(e) => setTuitionFeeData({
                          ...tuitionFeeData,
                          otherFees: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        Échéancier (par mois)
                      </h3>
                      {tuitionFeeData.totalAmount > 0 && tuitionFeeData.schedules.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const evenAmount = calculateEvenDistribution(
                              tuitionFeeData.totalAmount,
                              tuitionFeeData.schedules.length
                            );
                            const newSchedules = tuitionFeeData.schedules.map((s, idx) => ({
                              ...s,
                              amount: idx === tuitionFeeData.schedules.length - 1
                                ? tuitionFeeData.totalAmount - (evenAmount * (tuitionFeeData.schedules.length - 1))
                                : evenAmount
                            }));
                            setTuitionFeeData({
                              ...tuitionFeeData,
                              schedules: newSchedules
                            });
                          }}
                        >
                          <Icons.DollarSign className="w-3 h-3 mr-1" />
                          Distribuer
                        </Button>
                      )}
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-4 space-y-2 max-h-52 overflow-y-auto">
                      {tuitionFeeData.schedules.map((schedule, index) => {
                        const monthNames = [
                          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                        ];
                        const monthName = monthNames[schedule.due_month - 1] || `Mois ${schedule.due_month}`;
                        return (
                          <div key={index} className="flex gap-2 items-end">
                            <label className="text-xs font-medium text-neutral-700 w-24">{monthName}</label>
                            <input
                              type="number"
                              value={schedule.amount}
                              onChange={(e) => {
                                const newSchedules = [...tuitionFeeData.schedules];
                                newSchedules[index].amount = parseInt(e.target.value) || 0;
                                setTuitionFeeData({
                                  ...tuitionFeeData,
                                  schedules: newSchedules
                                });
                              }}
                              className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded text-xs text-neutral-700">
                    <strong>Total configuré:</strong> {tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0)} XOF
                  </div>

                  <Button
                    onClick={handleSaveTuitionFees}
                    disabled={isSavingFees || !currentYear}
                    className="w-full"
                  >
                    {isSavingFees ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-neutral-200">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedClass(null);
                    setModalTab('overview');
                  }}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de création de classe avec étapes */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Indicateur d'étapes */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${createStep === 1 ? 'bg-primary-600 text-white' : 'bg-green-600 text-white'}`}>
                    {createStep === 1 ? '1' : '✓'}
                  </div>
                  <div className={`w-16 h-1 ${createStep === 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${createStep === 2 ? 'bg-primary-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    2
                  </div>
                </div>
              </div>

              {/* Étape 1: Informations de la classe */}
              {createStep === 1 && (
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                    Étape 1: Informations de la classe
                  </h2>
                  <form onSubmit={handleCreateClass} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la classe *</label>
                        <Input
                          placeholder="CP1, CE2..."
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Niveau *</label>
                        <Input
                          placeholder="CP, CE1, CM2..."
                          value={formData.level}
                          onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Année scolaire *</label>
                        <select
                          value={formData.year_id}
                          onChange={(e) => {
                            const yearId = e.target.value;
                            setFormData({ ...formData, year_id: yearId });
                            
                            // Générer automatiquement les échéanciers quand une année est sélectionnée
                            if (yearId) {
                              const selectedYear = years.find(y => y.id === yearId);
                              if (selectedYear) {
                                const monthSchedules = generateMonthSchedules(selectedYear);
                                setTuitionFeeData({
                                  ...tuitionFeeData,
                                  schedules: monthSchedules
                                });
                              }
                            } else {
                              setTuitionFeeData({
                                ...tuitionFeeData,
                                schedules: []
                              });
                            }
                          }}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                          required
                        >
                          <option value="">Sélectionner...</option>
                          {years.map(year => (
                            <option key={year.id} value={year.id}>{year.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enseignant principal</label>
                        <select
                          value={formData.teacher_id}
                          onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg"
                        >
                          <option value="">Aucun...</option>
                          {availableTeachers.map(teacher => (
                            <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacité</label>
                        <Input
                          type="number"
                          placeholder="30"
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          📅 Jour d'échéance mensuel *
                          <span className="text-xs text-neutral-500 ml-2">(ex: 5 = le 5 de chaque mois)</span>
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="5"
                          value={formData.payment_due_day}
                          onChange={(e) => setFormData({ ...formData, payment_due_day: parseInt(e.target.value) || 5 })}
                          required
                        />
                        <p className="text-xs text-neutral-500 mt-1">
                          Les parents seront rappelés si le paiement n'est pas effectué à cette date
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowCreateModal(false);
                          setCreateStep(1);
                          setFormData({ name: '', level: '', capacity: 30, year_id: '', teacher_id: '', payment_due_day: 5 });
                        }}
                        className="flex-1"
                      >
                        Annuler
                      </Button>
                      <Button type="submit" className="flex-1 bg-primary-600">
                        Suivant →
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Étape 2: Frais de scolarité (copie de l'onglet fees existant) */}
              {createStep === 2 && (
                <div className="space-y-6">
                  {(() => {
                    const selectedYear = years.find(y => y.id === formData.year_id);
                    return (
                    <>
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                      Étape 2: Frais de scolarité (OBLIGATOIRE)
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Classe: <strong>{formData.name}</strong> - Année: <strong>{selectedYear?.name}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Frais annuels *</label>
                      <input
                        type="number"
                        value={tuitionFeeData.totalAmount || ''}
                        onChange={(e) => setTuitionFeeData({ ...tuitionFeeData, totalAmount: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded"
                        placeholder="200000"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Frais d'inscription *</label>
                      <input
                        type="number"
                        value={tuitionFeeData.registrationFee || ''}
                        onChange={(e) => setTuitionFeeData({ ...tuitionFeeData, registrationFee: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded"
                        placeholder="2000"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Autres frais</label>
                      <input
                        type="number"
                        value={tuitionFeeData.otherFees || ''}
                        onChange={(e) => setTuitionFeeData({ ...tuitionFeeData, otherFees: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded"
                        placeholder="2000"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-neutral-900">Échéanciers de paiement *</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const selectedYear = years.find(y => y.id === formData.year_id);
                            if (!selectedYear) {
                              toast.error('Sélectionnez d\'abord une année scolaire');
                              return;
                            }
                            const availableMonths = getAvailableMonthsForYear(selectedYear);
                            const usedMonths = tuitionFeeData.schedules.map(s => s.due_month);
                            const nextAvailableMonth = availableMonths.find(m => !usedMonths.includes(m));
                            
                            if (!nextAvailableMonth) {
                              toast.error('Tous les mois de l\'année sont déjà utilisés');
                              return;
                            }
                            
                            const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                            const newSchedule = {
                              installment_number: tuitionFeeData.schedules.length + 1,
                              due_month: nextAvailableMonth,
                              amount: 0,
                              description: `Versement ${tuitionFeeData.schedules.length + 1} (${monthNames[nextAvailableMonth - 1]})`
                            };
                            setTuitionFeeData({
                              ...tuitionFeeData,
                              schedules: [...tuitionFeeData.schedules, newSchedule]
                            });
                          }}
                          disabled={!formData.year_id}
                        >
                          <Icons.Plus className="w-3 h-3 mr-1" />
                          Ajouter
                        </Button>
                        {tuitionFeeData.schedules.length > 0 && tuitionFeeData.totalAmount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const baseAmount = Math.floor(tuitionFeeData.totalAmount / tuitionFeeData.schedules.length);
                              const remainder = tuitionFeeData.totalAmount % tuitionFeeData.schedules.length;
                              const newSchedules = tuitionFeeData.schedules.map((schedule, index) => ({
                                ...schedule,
                                amount: baseAmount + (index === tuitionFeeData.schedules.length - 1 ? remainder : 0)
                              }));
                              setTuitionFeeData({ ...tuitionFeeData, schedules: newSchedules });
                            }}
                          >
                            <Icons.DollarSign className="w-3 h-3 mr-1" />
                            Distribuer
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-4 space-y-2 max-h-52 overflow-y-auto">
                      {tuitionFeeData.schedules.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Aucun échéancier. Cliquez sur "Ajouter" pour créer un versement.
                        </p>
                      ) : (
                        tuitionFeeData.schedules.map((schedule, index) => {
                          const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                          const selectedYear = years.find(y => y.id === formData.year_id);
                          const availableMonths = getAvailableMonthsForYear(selectedYear);
                          
                          return (
                            <div key={index} className="flex gap-2 items-center">
                              <select
                                value={schedule.due_month}
                                onChange={(e) => {
                                  const newMonth = parseInt(e.target.value);
                                  const newSchedules = [...tuitionFeeData.schedules];
                                  newSchedules[index].due_month = newMonth;
                                  newSchedules[index].description = `Versement ${index + 1} (${monthNames[newMonth - 1]})`;
                                  setTuitionFeeData({ ...tuitionFeeData, schedules: newSchedules });
                                }}
                                className="w-32 px-2 py-2 border border-neutral-300 rounded text-sm"
                              >
                                {availableMonths.map(monthNum => (
                                  <option key={monthNum} value={monthNum}>
                                    {monthNames[monthNum - 1]}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={schedule.amount || ''}
                                placeholder="Montant"
                                min="0"
                                onChange={(e) => {
                                  const newSchedules = [...tuitionFeeData.schedules];
                                  newSchedules[index].amount = e.target.value === '' ? 0 : parseInt(e.target.value);
                                  setTuitionFeeData({ ...tuitionFeeData, schedules: newSchedules });
                                }}
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newSchedules = tuitionFeeData.schedules.filter((_, i) => i !== index);
                                  // Réajuster les numéros de versement
                                  newSchedules.forEach((s, idx) => {
                                    s.installment_number = idx + 1;
                                    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                                    s.description = `Versement ${idx + 1} (${monthNames[s.due_month - 1]})`;
                                  });
                                  setTuitionFeeData({ ...tuitionFeeData, schedules: newSchedules });
                                }}
                                className="p-2"
                              >
                                <Icons.X className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className={`p-3 rounded text-xs ${tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0) !== tuitionFeeData.totalAmount ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    <strong>Total configuré pour les versements:</strong> {tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0).toLocaleString('fr-FR')} XOF
                    <div className="mt-1 text-xs">Frais de scolarité à échelonner: {tuitionFeeData.totalAmount.toLocaleString('fr-FR')} XOF</div>
                    {tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0) > tuitionFeeData.totalAmount && (
                      <div className="mt-1 font-semibold">
                        ⚠️ Les versements dépassent les frais de scolarité ({tuitionFeeData.totalAmount.toLocaleString('fr-FR')} XOF)
                      </div>
                    )}
                    {tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0) < tuitionFeeData.totalAmount && (
                      <div className="mt-1 font-semibold">
                        ⚠️ Les versements sont inférieurs aux frais de scolarité ({tuitionFeeData.totalAmount.toLocaleString('fr-FR')} XOF)
                      </div>
                    )}
                    {tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0) === tuitionFeeData.totalAmount && tuitionFeeData.totalAmount > 0 && (
                      <div className="mt-1 font-semibold">
                        ✓ Total des versements = Frais de scolarité
                      </div>
                    )}
                    <div className="mt-2 text-xs font-semibold">
                      Frais d'inscription: {tuitionFeeData.registrationFee.toLocaleString('fr-FR')} XOF + Frais annexes: {tuitionFeeData.otherFees.toLocaleString('fr-FR')} XOF (non échelonnés)
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateStep(1)}
                      className="flex-1"
                    >
                      ← Retour
                    </Button>
                    <Button
                      onClick={handleCompleteClassCreation}
                      disabled={isCreating || tuitionFeeData.schedules.length === 0 || tuitionFeeData.schedules.reduce((sum, s) => sum + s.amount, 0) !== tuitionFeeData.totalAmount}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isCreating ? 'Création...' : 'Créer la classe'}
                    </Button>
                  </div>
                    </>
                    );
                  })()}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Créer une nouvelle classe</h2>
          <Button
            onClick={() => {
              setShowCreateModal(true);
              setCreateStep(1);
              setTuitionFeeData({
                totalAmount: 0,
                registrationFee: 0,
                otherFees: 0,
                schedules: []
              });
            }}
            className="w-full bg-primary-600"
          >
            <Icons.Plus className="w-4 h-4 mr-2" />
            Nouvelle classe avec échéanciers
          </Button>
        </div>
      </Card>

      {classes.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed border-neutral-200">
          <Icons.BookOpen className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600">Aucune classe créée</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card key={cls.id} className="border border-neutral-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-neutral-900">{cls.name}</h3>
                  <p className="text-xs text-neutral-600">{cls.level}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClass(cls.id)}
                >
                  <Icons.Trash className="w-4 h-4 text-red-600" />
                </Button>
              </div>
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Élèves:</span>
                  <span className="font-medium">{cls.student_count || 0}/{cls.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Enseignants:</span>
                  <span className="font-medium">{cls.teacher_count || 0}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => setSelectedClass(cls)}
              >
                Gérer
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
