'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { toast } from 'sonner';

interface UserDetailsModalProps {
  userId: string;
  userRole: string;
  onClose: () => void;
  onEdit?: () => void;
}

interface UserDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
}

interface StudentDetails extends UserDetails {
  matricule: string;
  date_of_birth: string;
  place_of_birth: string;
  gender: string;
  enrollment_date: string;
  class?: {
    name: string;
    level: string;
  };
  parents?: Array<{
    id: string;
    full_name: string;
    phone: string;
  }>;
  tuition_fees?: {
    total: number;
    paid: number;
    remaining: number;
  };
  attendance_rate?: number;
}

interface ParentDetails extends UserDetails {
  children?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    matricule: string;
    photo_url: string | null;
    class_name: string;
  }>;
  payment_summary?: {
    total_due: number;
    total_paid: number;
    total_remaining: number;
  };
}

interface EmployeeDetails extends UserDetails {
  employee_number?: string;
  hire_date?: string;
  position?: string;
  contract_type?: string;
  base_salary?: number;
  attendance_rate?: number;
  leave_balance?: number;
  classes_taught?: string[];
}

export function UserDetailsModal({ userId, userRole, onClose, onEdit }: UserDetailsModalProps) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [specificDetails, setSpecificDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserDetails();
  }, [userId, userRole]);

  async function loadUserDetails() {
    try {
      setIsLoading(true);

      if (userRole === 'STUDENT') {
        await loadStudentDetails();
      } else if (userRole === 'PARENT') {
        await loadParentDetails();
      } else if (['TEACHER', 'SECRETARY', 'ACCOUNTANT', 'HR', 'ADMIN'].includes(userRole)) {
        await loadEmployeeDetails();
      } else {
        await loadBasicUserDetails();
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      toast.error('Erreur lors du chargement des détails');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadBasicUserDetails() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    setUser(data);
  }

  async function loadStudentDetails() {
    // Charger les détails de l'élève
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        *,
        classes(name, level),
        parents_students(
          parents:users!parents_students_parent_id_fkey(
            id,
            full_name,
            phone
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (studentError) throw studentError;

    // Charger les frais de scolarité
    const { data: tuitionData } = await supabase
      .from('tuition_fees')
      .select('amount')
      .eq('student_id', userId);

    const totalDue = tuitionData?.reduce((sum, t) => sum + t.amount, 0) || 0;

    const { data: paymentsData } = await supabase
      .from('tuition_payments')
      .select('amount')
      .eq('student_id', userId);

    const totalPaid = paymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0;

    // Calculer le taux de présence
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', userId);

    const totalDays = attendanceData?.length || 0;
    const presentDays = attendanceData?.filter(a => 
      ['PRESENT', 'LATE', 'EXCUSED'].includes(a.status)
    ).length || 0;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    setUser({
      id: student.id,
      full_name: `${student.first_name} ${student.last_name}`,
      email: '',
      phone: null,
      address: null,
      role: 'STUDENT',
      is_active: true,
      created_at: student.created_at,
      avatar_url: student.photo_url,
    });

    setSpecificDetails({
      matricule: student.matricule,
      date_of_birth: student.date_of_birth,
      place_of_birth: student.place_of_birth,
      gender: student.gender,
      enrollment_date: student.enrollment_date,
      class: student.classes,
      parents: student.parents_students?.map((ps: any) => ps.parents) || [],
      tuition_fees: {
        total: totalDue,
        paid: totalPaid,
        remaining: totalDue - totalPaid,
      },
      attendance_rate: attendanceRate,
    });
  }

  async function loadParentDetails() {
    // Charger les détails du parent
    const { data: parent, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (parentError) throw parentError;

    // Charger les enfants
    const { data: children } = await supabase
      .from('parents_students')
      .select(`
        students(
          id,
          first_name,
          last_name,
          matricule,
          photo_url,
          classes(name)
        )
      `)
      .eq('parent_id', userId);

    const studentIds = children?.map((c: any) => c.students.id) || [];

    // Calculer le résumé des paiements
    let totalDue = 0;
    let totalPaid = 0;

    if (studentIds.length > 0) {
      const { data: tuitionData } = await supabase
        .from('tuition_fees')
        .select('amount')
        .in('student_id', studentIds);

      totalDue = tuitionData?.reduce((sum, t) => sum + t.amount, 0) || 0;

      const { data: paymentsData } = await supabase
        .from('tuition_payments')
        .select('amount')
        .in('student_id', studentIds);

      totalPaid = paymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0;
    }

    setUser(parent);
    setSpecificDetails({
      children: children?.map((c: any) => ({
        ...c.students,
        class_name: c.students.classes?.name || 'N/A',
      })) || [],
      payment_summary: {
        total_due: totalDue,
        total_paid: totalPaid,
        total_remaining: totalDue - totalPaid,
      },
    });
  }

  async function loadEmployeeDetails() {
    // Charger les détails de l'utilisateur
    const { data: employee, error: employeeError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (employeeError) throw employeeError;

    // Charger les détails de la fiche de paie (dernier enregistrement)
    const { data: payrollRecords, error: payrollError } = await supabase
      .from('payrolls')
      .select('base_salary')
      .eq('employee_id', userId)
      .order('period', { ascending: false })
      .limit(1);

    if (payrollError) {
      console.error('Erreur chargement payroll:', payrollError);
    }

    console.log('Payroll data:', payrollRecords);

    const payrollData = payrollRecords && payrollRecords.length > 0 ? payrollRecords[0] : null;

    // Charger le taux de présence (si existe dans attendance_records)
    const { data: attendanceData } = await supabase
      .from('attendance_records')
      .select('status')
      .eq('employee_id', userId);

    const totalDays = attendanceData?.length || 0;
    const presentDays = attendanceData?.filter(a => 
      ['present', 'late'].includes(a.status)
    ).length || 0;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    // Charger les congés
    const { data: leavesData } = await supabase
      .from('leave_requests')
      .select('total_days, status')
      .eq('employee_id', userId)
      .eq('status', 'approved');

    const usedLeaveDays = leavesData?.reduce((sum, l) => sum + l.total_days, 0) || 0;
    const leaveBalance = 30 - usedLeaveDays; // Supposons 30 jours de congés annuels

    // Pour les enseignants, charger les classes
    let classesTaught: string[] = [];
    if (userRole === 'TEACHER') {
      const { data: classesData } = await supabase
        .from('teacher_classes')
        .select('classes(name)')
        .eq('teacher_id', userId);

      classesTaught = classesData?.map((c: any) => c.classes.name) || [];
    }

    setUser(employee);
    setSpecificDetails({
      base_salary: payrollData?.base_salary || 0,
      attendance_rate: attendanceRate,
      leave_balance: leaveBalance,
      classes_taught: classesTaught,
    });
  }

  async function handleResetPassword() {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: `Temp${Math.random().toString(36).slice(-8)}!`,
      });

      if (error) throw error;
      toast.success('Mot de passe réinitialisé');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la réinitialisation');
    }
  }

  async function handleToggleStatus() {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user?.is_active })
        .eq('id', userId);

      if (error) throw error;
      toast.success(`Compte ${user?.is_active ? 'désactivé' : 'activé'}`);
      loadUserDetails();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la modification du statut');
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="max-w-4xl w-full mx-4 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <Avatar name={user.full_name} src={user.avatar_url || undefined} size="xl" />
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">{user.full_name}</h2>
              <p className="text-sm text-neutral-600">
                {userRole === 'STUDENT' ? 'Élève' : user.role.replace('_', ' ')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  user.is_active 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {user.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <Icons.X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Informations de base */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Informations de base</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.email && (
                <div className="flex items-center gap-3">
                  <Icons.Mail className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">Email</p>
                    <p className="text-sm font-medium text-neutral-900">{user.email}</p>
                  </div>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-3">
                  <Icons.Phone className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">Téléphone</p>
                    <p className="text-sm font-medium text-neutral-900">{user.phone}</p>
                  </div>
                </div>
              )}
              {user.address && (
                <div className="flex items-center gap-3">
                  <Icons.MapPin className="h-5 w-5 text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">Adresse</p>
                    <p className="text-sm font-medium text-neutral-900">{user.address}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Icons.Calendar className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-xs text-neutral-500">Créé le</p>
                  <p className="text-sm font-medium text-neutral-900">{formatDate(user.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Détails spécifiques pour STUDENT */}
          {userRole === 'STUDENT' && specificDetails && (
            <>
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Informations scolaires</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Icons.Hash className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Matricule</p>
                      <p className="text-sm font-medium text-neutral-900">{specificDetails.matricule}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icons.BookOpen className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Classe</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {specificDetails.class?.name || 'Non assigné'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icons.Calendar className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Date de naissance</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {formatDate(specificDetails.date_of_birth)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icons.MapPin className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Lieu de naissance</p>
                      <p className="text-sm font-medium text-neutral-900">{specificDetails.place_of_birth}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icons.User className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Sexe</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {specificDetails.gender === 'M' ? 'Masculin' : 'Féminin'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icons.Calendar className="h-5 w-5 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-500">Date d'inscription</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {formatDate(specificDetails.enrollment_date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parents */}
              {specificDetails.parents && specificDetails.parents.length > 0 && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Parents</h3>
                  <div className="space-y-3">
                    {specificDetails.parents.map((parent: any) => (
                      <div key={parent.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                        <Avatar name={parent.full_name} size="sm" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900">{parent.full_name}</p>
                          <p className="text-xs text-neutral-500">{parent.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Frais de scolarité */}
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Frais de scolarité</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Total</p>
                    <p className="text-lg font-bold text-blue-900">
                      {formatCurrency(specificDetails.tuition_fees.total)}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Payé</p>
                    <p className="text-lg font-bold text-green-900">
                      {formatCurrency(specificDetails.tuition_fees.paid)}
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-600 mb-1">Restant</p>
                    <p className="text-lg font-bold text-orange-900">
                      {formatCurrency(specificDetails.tuition_fees.remaining)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Taux de présence */}
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Présence</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${specificDetails.attendance_rate}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-neutral-900">
                    {specificDetails.attendance_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Détails spécifiques pour PARENT */}
          {userRole === 'PARENT' && specificDetails && (
            <>
              {/* Enfants */}
              {specificDetails.children && specificDetails.children.length > 0 && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Enfants</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {specificDetails.children.map((child: any) => (
                      <div key={child.id} className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg">
                        <Avatar name={`${child.first_name} ${child.last_name}`} src={child.photo_url} size="md" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900">
                            {child.first_name} {child.last_name}
                          </p>
                          <p className="text-xs text-neutral-500">{child.class_name}</p>
                          <p className="text-xs text-neutral-400">Mat: {child.matricule}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Résumé des paiements */}
              {specificDetails.payment_summary && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Résumé des paiements</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 mb-1">Total à payer</p>
                      <p className="text-lg font-bold text-blue-900">
                        {formatCurrency(specificDetails.payment_summary.total_due)}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 mb-1">Total payé</p>
                      <p className="text-lg font-bold text-green-900">
                        {formatCurrency(specificDetails.payment_summary.total_paid)}
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-xs text-orange-600 mb-1">Restant</p>
                      <p className="text-lg font-bold text-orange-900">
                        {formatCurrency(specificDetails.payment_summary.total_remaining)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Détails spécifiques pour EMPLOYÉS */}
          {['TEACHER', 'SECRETARY', 'ACCOUNTANT', 'HR', 'ADMIN'].includes(userRole) && specificDetails && (
            <>
              {/* Informations RH */}
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Informations RH</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Salaire mensuel</p>
                    <p className="text-lg font-bold text-green-900">
                      {specificDetails.base_salary !== undefined 
                        ? formatCurrency(specificDetails.base_salary)
                        : 'Non défini'
                      }
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Solde congés</p>
                    <p className="text-lg font-bold text-blue-900">{specificDetails.leave_balance} jours</p>
                  </div>
                </div>
              </div>

              {/* Taux de présence */}
              {specificDetails.attendance_rate > 0 && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Taux de présence</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${specificDetails.attendance_rate}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-neutral-900">
                      {specificDetails.attendance_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Classes enseignées (pour TEACHER) */}
              {userRole === 'TEACHER' && specificDetails.classes_taught && specificDetails.classes_taught.length > 0 && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Classes enseignées</h3>
                  <div className="flex flex-wrap gap-2">
                    {specificDetails.classes_taught.map((className: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
                      >
                        {className}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleResetPassword}>
              <Icons.Key className="h-4 w-4 mr-2" />
              Réinitialiser mot de passe
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              className={user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
            >
              <Icons.Power className="h-4 w-4 mr-2" />
              {user.is_active ? 'Désactiver' : 'Activer'}
            </Button>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button onClick={onEdit}>
                <Icons.Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
