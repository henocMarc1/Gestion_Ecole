'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icons } from '@/components/ui/Icons';
import { notifyPaymentReceived } from '@/lib/notificationHelpers';
import { toast } from 'sonner';
import { DollarSign, User, Calendar, Check, X, Plus, Search } from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string;
  photo_url?: string | null;
  class: {
    name: string;
  };
}

interface TuitionFee {
  id: string;
  total_amount: number;
  registration_fee: number;
  other_fees: number;
  academic_year: string;
}

interface PaymentSchedule {
  id: string;
  installment_number: number;
  due_month: number;
  amount: number;
  description: string;
}

interface TuitionPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string;
  notes: string;
}

interface StudentPaymentStatus {
  student: Student;
  tuitionFee: TuitionFee | null;
  paymentSchedules: PaymentSchedule[];
  payments: TuitionPayment[];
  totalPaid: number;
  totalDue: number;
  balance: number;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'BANK_TRANSFER', label: 'Virement bancaire' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function TuitionPaymentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentPaymentStatus[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentPaymentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentPaymentStatus | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'CASH',
    reference: '',
    notes: '',
  });
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  useEffect(() => {
    if (user?.school_id) {
      loadStudentsWithPayments();
    }
  }, [user]);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, classFilter, statusFilter, students]);

  useRealtimeSubscription({
    table: 'tuition_fees',
    event: '*',
    onData: () => loadStudentsWithPayments(),
    enabled: true,
  });

  useRealtimeSubscription({
    table: 'payment_schedules',
    event: '*',
    onData: () => loadStudentsWithPayments(),
    enabled: true,
  });

  useRealtimeSubscription({
    table: 'tuition_payments',
    event: '*',
    onData: () => loadStudentsWithPayments(),
    enabled: true,
  });

  const loadStudentsWithPayments = async () => {
    if (!user?.school_id) return;

    setIsLoading(true);
    try {
      // Récupérer tous les élèves avec leurs classes
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, photo_url, class_id, classes(name)')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('last_name');

      if (studentsError) throw studentsError;

      // Pour chaque élève, récupérer frais, échéanciers et paiements
      const studentsWithPayments: StudentPaymentStatus[] = await Promise.all(
        (studentsData || []).map(async (student: any) => {
          if (!student.class_id) {
            return {
              student: { ...student, class: student.classes || { name: 'Non assigné' } },
              tuitionFee: null,
              paymentSchedules: [],
              payments: [],
              totalPaid: 0,
              totalDue: 0,
              balance: 0,
            };
          }

          // Récupérer les frais de scolarité
          const { data: feeData } = await supabase
            .from('tuition_fees')
            .select('*')
            .eq('class_id', student.class_id)
            .eq('school_id', user.school_id)
            .order('academic_year', { ascending: false })
            .limit(1)
            .maybeSingle();

          let schedules: PaymentSchedule[] = [];
          if (feeData) {
            const { data: schedulesData } = await supabase
              .from('payment_schedules')
              .select('*')
              .eq('tuition_fee_id', feeData.id)
              .order('installment_number');
            schedules = schedulesData || [];
          }

          // Récupérer les paiements de cet élève
          const { data: paymentsData } = await supabase
            .from('tuition_payments')
            .select('*')
            .eq('student_id', student.id)
            .eq('school_id', user.school_id)
            .order('payment_date', { ascending: false });

          const payments = paymentsData || [];
          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
          const totalDue = feeData ? feeData.total_amount + feeData.registration_fee + feeData.other_fees : 0;
          const balance = totalDue - totalPaid;

          return {
            student: { ...student, class: student.classes || { name: 'Non assigné' } },
            tuitionFee: feeData,
            paymentSchedules: schedules,
            payments,
            totalPaid,
            totalDue,
            balance,
          };
        })
      );

      setStudents(studentsWithPayments);
      setFilteredStudents(studentsWithPayments);
    } catch (error) {
      console.error('Error loading students payments:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const filterStudents = () => {
    const term = searchTerm.toLowerCase();

    const next = students.filter((s) => {
      const matchesSearch =
        !term ||
        s.student.first_name.toLowerCase().includes(term) ||
        s.student.last_name.toLowerCase().includes(term) ||
        s.student.matricule.toLowerCase().includes(term);

      const matchesClass =
        classFilter === 'all' || s.student.class.name === classFilter;

      const status = getScheduleStatus(s);
      const matchesStatus = (() => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'solde') return status.text === 'Soldé';
        if (statusFilter === 'retard') return status.text.startsWith('Retard');
        if (statusFilter === 'echeance10') return status.color.includes('yellow');
        if (statusFilter === 'avenir') return status.color.includes('blue');
        if (statusFilter === 'partiel') return status.text === 'Partiel';
        if (statusFilter === 'impaye') return status.text === 'Impayé';
        if (statusFilter === 'aucun') return status.text === 'Aucun frais';
        return true;
      })();

      return matchesSearch && matchesClass && matchesStatus;
    });

    setFilteredStudents(next);
  };

  const handleAddPayment = (studentStatus: StudentPaymentStatus) => {
    setSelectedStudent(studentStatus);
    setPaymentForm({
      amount: studentStatus.balance > 0 ? studentStatus.balance.toString() : '',
      payment_method: 'CASH',
      reference: '',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!selectedStudent || !paymentForm.amount) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const amount = parseFloat(paymentForm.amount);
    if (amount <= 0) {
      toast.error('Le montant doit être supérieur à 0');
      return;
    }

    if (amount > selectedStudent.balance) {
      toast.error('Le montant dépasse le solde restant');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('tuition_payments').insert({
        school_id: user?.school_id,
        student_id: selectedStudent.student.id,
        tuition_fee_id: selectedStudent.tuitionFee?.id,
        amount: amount,
        payment_date: new Date().toISOString(),
        payment_method: paymentForm.payment_method,
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null,
        recorded_by: user?.id,
      });

      if (!error) {
        // Notify parents about payment received
        const { data: parentLinks } = await supabase
          .from('parents_students')
          .select('parent_id')
          .eq('student_id', selectedStudent.student.id);

        const parentIds = parentLinks?.map((p) => p.parent_id) || [];
        
        if (parentIds.length > 0) {
          try {
            await notifyPaymentReceived(
              user?.school_id || '',
              `${selectedStudent.student.first_name} ${selectedStudent.student.last_name}`,
              amount,
              parentIds
            );
          } catch (notifError) {
            console.warn('Avertissement - Notification non créée:', notifError);
          }
        }
      }

      if (error) throw error;

      toast.success('Paiement enregistré avec succès');
      setShowPaymentModal(false);
      loadStudentsWithPayments();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getAcademicYearStart = (academicYear?: string) => {
    const match = academicYear?.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : new Date().getFullYear();
  };

  const getDueDateForSchedule = (dueMonth: number, academicYear?: string) => {
    const startYear = getAcademicYearStart(academicYear);
    const year = dueMonth >= 9 ? startYear : startYear + 1;
    return new Date(year, dueMonth - 1, 1); // 1er du mois comme repère
  };

  const getScheduleStatus = (studentStatus: StudentPaymentStatus) => {
    if (studentStatus.totalDue === 0) {
      return { color: 'bg-gray-100 text-gray-800', text: 'Aucun frais' };
    }

    if (studentStatus.balance === 0) {
      return { color: 'bg-green-100 text-green-800', text: 'Soldé' };
    }

    const schedules = [...studentStatus.paymentSchedules].sort(
      (a, b) => a.installment_number - b.installment_number
    );

    if (schedules.length === 0) {
      return studentStatus.totalPaid > 0
        ? { color: 'bg-yellow-100 text-yellow-800', text: 'Partiel' }
        : { color: 'bg-red-100 text-red-800', text: 'Impayé' };
    }

    // Répartir le total payé sur les échéances dans l'ordre
    let remainingPaid = studentStatus.totalPaid;
    let nextSchedule = null as (typeof schedules)[number] | null;

    for (const sched of schedules) {
      const remainingForSched = Math.max(0, sched.amount - remainingPaid);
      remainingPaid = Math.max(0, remainingPaid - sched.amount);
      if (remainingForSched > 0) {
        nextSchedule = sched;
        break;
      }
    }

    if (!nextSchedule) {
      // Tous les schedules sont couverts mais solde non nul (cas de cohérence)
      return { color: 'bg-yellow-100 text-yellow-800', text: 'Partiel' };
    }

    const dueDate = getDueDateForSchedule(
      nextSchedule.due_month,
      studentStatus.tuitionFee?.academic_year
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 1000 * 60 * 60 * 24;
    const deltaDays = Math.floor((dueDate.getTime() - today.getTime()) / msPerDay);

    if (deltaDays < 0) {
      return { color: 'bg-red-100 text-red-800', text: `Retard ${Math.abs(deltaDays)} j` };
    }

    if (deltaDays <= 10) {
      return { color: 'bg-yellow-100 text-yellow-800', text: `Échéance dans ${deltaDays} j` };
    }

    return { color: 'bg-blue-100 text-blue-800', text: `Échéance dans ${deltaDays} j` };
  };

  const handleDownloadPaymentReceipt = async (payment: TuitionPayment) => {
    if (!selectedStudent) return;

    setIsDownloadingReceipt(true);
    try {
      // Récupérer les infos de l'école
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name, address, phone')
        .eq('id', user?.school_id)
        .single();

      const receiptData = {
        student_name: `${selectedStudent.student.first_name} ${selectedStudent.student.last_name}`,
        student_matricule: selectedStudent.student.matricule,
        student_photo_url: selectedStudent.student.photo_url,
        class_name: selectedStudent.student.class.name,
        payment_amount: payment.amount,
        payment_date: payment.payment_date,
        payment_method: PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label || payment.payment_method,
        payment_reference: payment.reference || '',
        registration_fee: selectedStudent.tuitionFee?.registration_fee || 0,
        tuition_fee: selectedStudent.tuitionFee?.total_amount || 0,
        other_fees: selectedStudent.tuitionFee?.other_fees || 0,
        total_due: selectedStudent.totalDue,
        total_paid: selectedStudent.totalPaid,
        balance: selectedStudent.balance,
        all_payments: selectedStudent.payments.map(p => ({
          amount: p.amount,
          payment_date: p.payment_date,
          payment_method: PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method,
          reference: p.reference || ''
        })),
        payment_schedules: selectedStudent.paymentSchedules.map(s => ({
          installment_number: s.installment_number,
          due_month: s.due_month,
          amount: s.amount,
          description: s.description
        })),
        school_name: schoolData?.name || 'Groupe Scolaire Gnamien-Assa',
        school_address: schoolData?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
        school_phone: schoolData?.phone || '+225 0707905958',
        academic_year: selectedStudent.tuitionFee?.academic_year || '',
        recorded_by: user?.full_name || 'Secrétaire',
      };

      const response = await fetch('/api/pdf/tuition-payment-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du reçu');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${selectedStudent.student.matricule}-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Reçu téléchargé avec succès');
    } catch (error: any) {
      console.error('Error downloading receipt:', error);
      toast.error(error.message || 'Erreur lors du téléchargement');
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <DollarSign className="w-12 h-12 text-primary-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paiements des frais de scolarité</h1>
        <p className="text-gray-600 mt-2">Enregistrer et suivre les paiements des élèves</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Total attendu</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(students.reduce((sum, s) => sum + s.totalDue, 0))}
          </p>
        </Card>
        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Total encaissé</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(students.reduce((sum, s) => sum + s.totalPaid, 0))}
          </p>
        </Card>
        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Solde restant</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(students.reduce((sum, s) => sum + s.balance, 0))}
          </p>
        </Card>
        <Card className="border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Élèves soldés</p>
          <p className="text-2xl font-bold text-primary-600">
            {students.filter((s) => s.balance === 0 && s.totalDue > 0).length} / {students.length}
          </p>
        </Card>
      </div>

      {/* Recherche */}
      <Card className="border border-gray-200 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un élève par nom ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Classe</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="all">Toutes les classes</option>
              {Array.from(new Set(students.map((s) => s.student.class.name))).map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Statut d'échéance</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="all">Tous les statuts</option>
              <option value="echeance10">Échéance ≤ 10 jours</option>
              <option value="retard">En retard</option>
              <option value="avenir">Échéance future</option>
              <option value="solde">Soldé</option>
              <option value="partiel">Partiel</option>
              <option value="impaye">Impayé</option>
              <option value="aucun">Aucun frais</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Liste des élèves */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Élève</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Classe</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total dû</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Payé</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Reste</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Aucun élève trouvé
                  </td>
                </tr>
              ) : (
                filteredStudents.map((studentStatus) => (
                  <tr key={studentStatus.student.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {studentStatus.student.first_name} {studentStatus.student.last_name}
                        </p>
                        <p className="text-xs font-mono text-primary-600">
                          {studentStatus.student.matricule}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {studentStatus.student.class.name}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(studentStatus.totalDue)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {formatCurrency(studentStatus.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {formatCurrency(studentStatus.balance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const status = getScheduleStatus(studentStatus);
                        return (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.color}`}
                          >
                            {status.text}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                        <button
                          onClick={() => handleAddPayment(studentStatus)}
                          disabled={studentStatus.balance <= 0}
                          className="text-primary-600 hover:text-primary-700 p-2 hover:bg-primary-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Enregistrer un paiement"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedStudent(studentStatus)}
                          className="text-gray-600 hover:text-gray-700 p-2 hover:bg-gray-50 rounded"
                          title="Voir les détails"
                        >
                          <Icons.Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal d'ajout de paiement */}
      {showPaymentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Enregistrer un paiement</span>
                <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Élève</p>
                <p className="font-semibold text-gray-900">
                  {selectedStudent.student.first_name} {selectedStudent.student.last_name}
                </p>
                <p className="text-sm text-gray-600 mt-2">Solde restant</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(selectedStudent.balance)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant payé (FCFA) *
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 50000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mode de paiement *
                </label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Référence (N° reçu, chèque...)
                </label>
                <Input
                  type="text"
                  placeholder="Ex: REC-2026-001"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  placeholder="Notes supplémentaires..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  rows={3}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSavePayment}
                  className="flex-1 bg-primary-600 hover:bg-primary-700"
                  disabled={isSaving}
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal détails élève */}
      {selectedStudent && !showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Détails des paiements</span>
                <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info élève */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {selectedStudent.student.first_name} {selectedStudent.student.last_name}
                </h3>
                <p className="text-sm text-gray-600">Matricule: {selectedStudent.student.matricule}</p>
                <p className="text-sm text-gray-600">Classe: {selectedStudent.student.class.name}</p>
              </div>

              {/* Résumé financier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-100 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total dû</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedStudent.totalDue)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Payé</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(selectedStudent.totalPaid)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-xs text-red-600 mb-1">Reste</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(selectedStudent.balance)}</p>
                </div>
              </div>

              {/* Historique des paiements */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Historique des paiements</h4>
                {selectedStudent.payments.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Aucun paiement enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudent.payments.map((payment) => (
                      <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-gray-600">
                            {new Date(payment.payment_date).toLocaleDateString('fr-FR')} • {PAYMENT_METHODS.find(m => m.value === payment.payment_method)?.label}
                          </p>
                          {payment.reference && (
                            <p className="text-xs text-gray-500">Réf: {payment.reference}</p>
                          )}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleDownloadPaymentReceipt(payment)}
                            disabled={isDownloadingReceipt}
                            className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Télécharger le reçu"
                          >
                            <Icons.Download className="w-4 h-4" />
                          </button>
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button variant="outline" onClick={() => setSelectedStudent(null)} className="w-full">
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
