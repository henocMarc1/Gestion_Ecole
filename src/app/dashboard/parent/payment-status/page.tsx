'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { DollarSign, Calendar, Check, User } from 'lucide-react';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string;
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

interface TuitionPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string;
}

interface ChildPaymentStatus {
  child: Child;
  tuitionFee: TuitionFee | null;
  payments: TuitionPayment[];
  totalPaid: number;
  totalDue: number;
  balance: number;
  paymentSchedules: Array<{
    installment_number: number;
    due_month: number;
    amount: number;
    description?: string;
  }>;
}

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement bancaire',
  CHECK: 'Chèque',
  MOBILE_MONEY: 'Mobile Money',
};

export default function ParentPaymentStatusPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildPaymentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadChildrenPaymentStatus();
    }
  }, [user]);

  const loadChildrenPaymentStatus = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Récupérer les enfants du parent
      const { data: parentsStudents, error: psError } = await supabase
        .from('parents_students')
        .select('student_id')
        .eq('parent_id', user.id);

      if (psError) throw psError;

      const studentIds = parentsStudents?.map((ps) => ps.student_id) || [];

      if (studentIds.length === 0) {
        setChildren([]);
        setIsLoading(false);
        return;
      }

      // Récupérer les informations des élèves
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, class_id, classes(name)')
        .in('id', studentIds)
        .is('deleted_at', null);

      if (studentsError) throw studentsError;

      // Pour chaque enfant, récupérer frais et paiements
      const childrenWithPayments: ChildPaymentStatus[] = await Promise.all(
        (studentsData || []).map(async (student: any) => {
          if (!student.class_id) {
            return {
              child: { ...student, class: student.classes || { name: 'Non assigné' } },
              tuitionFee: null,
              payments: [],
              paymentSchedules: [],
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

          // Récupérer les paiements
          const { data: paymentsData } = await supabase
            .from('tuition_payments')
            .select('*')
            .eq('student_id', student.id)
            .order('payment_date', { ascending: false });

          // Récupérer les échéances
          let schedules: ChildPaymentStatus['paymentSchedules'] = [];
          if (feeData) {
            const { data: schedulesData } = await supabase
              .from('payment_schedules')
              .select('installment_number, due_month, amount, description')
              .eq('tuition_fee_id', feeData.id)
              .order('installment_number');
            schedules = schedulesData || [];
          }

          const payments = paymentsData || [];
          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
          const totalDue = feeData
            ? feeData.total_amount + feeData.registration_fee + feeData.other_fees
            : 0;
          const balance = totalDue - totalPaid;

          return {
            child: { ...student, class: student.classes || { name: 'Non assigné' } },
            tuitionFee: feeData,
            payments,
            paymentSchedules: schedules,
            totalPaid,
            totalDue,
            balance,
          };
        })
      );

      setChildren(childrenWithPayments);
      if (childrenWithPayments.length > 0 && !selectedChild) {
        setSelectedChild(childrenWithPayments[0].child.id);
      }
    } catch (error) {
      console.error('Error loading children payment status:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
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
    return new Date(year, dueMonth - 1, 1);
  };

  const getScheduleStatus = (status: ChildPaymentStatus) => {
    if (status.totalDue === 0) return { color: 'bg-gray-100 text-gray-800', text: 'Aucun frais' };
    if (status.balance === 0) return { color: 'bg-green-100 text-green-800', text: 'Soldé' };

    const schedules = [...status.paymentSchedules].sort((a, b) => a.installment_number - b.installment_number);
    if (schedules.length === 0) {
      return status.totalPaid > 0
        ? { color: 'bg-yellow-100 text-yellow-800', text: 'Partiel' }
        : { color: 'bg-red-100 text-red-800', text: 'Impayé' };
    }

    let remainingPaid = status.totalPaid;
    let nextSchedule = null as (typeof schedules)[number] | null;

    for (const sched of schedules) {
      const remainingForSched = Math.max(0, sched.amount - remainingPaid);
      remainingPaid = Math.max(0, remainingPaid - sched.amount);
      if (remainingForSched > 0) {
        nextSchedule = sched;
        break;
      }
    }

    if (!nextSchedule) return { color: 'bg-yellow-100 text-yellow-800', text: 'Partiel' };

    const dueDate = getDueDateForSchedule(nextSchedule.due_month, status.tuitionFee?.academic_year);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 1000 * 60 * 60 * 24;
    const deltaDays = Math.floor((dueDate.getTime() - today.getTime()) / msPerDay);

    if (deltaDays < 0) return { color: 'bg-red-100 text-red-800', text: `Retard ${Math.abs(deltaDays)} j` };
    if (deltaDays <= 10) return { color: 'bg-yellow-100 text-yellow-800', text: `Échéance dans ${deltaDays} j` };
    return { color: 'bg-blue-100 text-blue-800', text: `Échéance dans ${deltaDays} j` };
  };

  const selectedChildStatus = children.find((c) => c.child.id === selectedChild);

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

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Avancement des paiements</h1>
          <p className="text-gray-600 mt-2">Suivez l'état des paiements des frais de scolarité</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun enfant enregistré</h3>
            <p className="text-gray-600">Contactez l'administration pour enregistrer vos enfants.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Avancement des paiements</h1>
        <p className="text-gray-600 mt-2">Suivez l'état des paiements des frais de scolarité de vos enfants</p>
      </div>

      {/* Sélection de l'enfant */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Sélectionner un enfant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((childStatus) => (
              <button
                key={childStatus.child.id}
                onClick={() => setSelectedChild(childStatus.child.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedChild === childStatus.child.id
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {childStatus.child.first_name} {childStatus.child.last_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{childStatus.child.class.name}</p>
                  </div>
                  {selectedChild === childStatus.child.id && (
                    <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                      <Icons.Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  {(() => {
                    const status = getScheduleStatus(childStatus);
                    return (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.color}`}
                      >
                        {status.text}
                      </span>
                    );
                  })()}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Détails du paiement pour l'enfant sélectionné */}
      {selectedChildStatus && (
        <div className="space-y-6">
          {!selectedChildStatus.tuitionFee ? (
            <Card>
              <CardContent className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun frais défini</h3>
                <p className="text-gray-600">
                  Les frais de scolarité pour la classe{' '}
                  <strong>{selectedChildStatus.child.class.name}</strong> n'ont pas encore été définis.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Résumé financier */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Résumé financier - {selectedChildStatus.child.first_name}{' '}
                    {selectedChildStatus.child.last_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-100 p-6 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total à payer</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(selectedChildStatus.totalDue)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Année: {selectedChildStatus.tuitionFee.academic_year}
                      </p>
                    </div>
                    <div className="bg-green-50 p-6 rounded-lg">
                      <p className="text-sm text-green-700 mb-1">Montant payé</p>
                      <p className="text-3xl font-bold text-green-600">
                        {formatCurrency(selectedChildStatus.totalPaid)}
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        {selectedChildStatus.payments.length} paiement(s)
                      </p>
                    </div>
                    <div className="bg-red-50 p-6 rounded-lg">
                      <p className="text-sm text-red-700 mb-1">Solde restant</p>
                      <p className="text-3xl font-bold text-red-600">
                        {formatCurrency(selectedChildStatus.balance)}
                      </p>
                      {selectedChildStatus.balance > 0 && (
                        <p className="text-xs text-red-600 mt-2">À régler</p>
                      )}
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Progression des paiements</span>
                      <span className="text-sm font-bold text-primary-600">
                        {selectedChildStatus.totalDue > 0
                          ? Math.round((selectedChildStatus.totalPaid / selectedChildStatus.totalDue) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-primary-600 h-4 rounded-full transition-all duration-500"
                        style={{
                          width: `${selectedChildStatus.totalDue > 0 ? (selectedChildStatus.totalPaid / selectedChildStatus.totalDue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Historique des paiements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Historique des paiements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedChildStatus.payments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Aucun paiement enregistré</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedChildStatus.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                              <Check className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(payment.amount)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(payment.payment_date).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {PAYMENT_METHODS[payment.payment_method] || payment.payment_method}
                                {payment.reference && ` • Réf: ${payment.reference}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Note d'information */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Icons.AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-2">Information</h4>
                      <p className="text-sm text-blue-800">
                        Pour effectuer un paiement, veuillez vous présenter au secrétariat ou contacter le
                        comptable de l'école. Pensez à bien conserver vos reçus de paiement.
                      </p>
                      {selectedChildStatus.balance > 0 && (
                        <p className="text-sm text-blue-800 mt-2 font-medium">
                          Montant à régler : {formatCurrency(selectedChildStatus.balance)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
