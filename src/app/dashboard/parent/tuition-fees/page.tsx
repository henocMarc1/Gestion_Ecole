'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { Calendar, DollarSign, BookOpen, User } from 'lucide-react';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  matricule: string;
  class_id: string;
  class: {
    name: string;
    level: string;
  };
}

interface TuitionFee {
  id: string;
  total_amount: number;
  registration_fee: number;
  other_fees: number;
  academic_year: string;
  description: string;
}

interface PaymentSchedule {
  installment_number: number;
  due_month: number;
  amount: number;
  description: string;
}

interface ChildWithFees extends Child {
  tuitionFee: TuitionFee | null;
  paymentSchedules: PaymentSchedule[];
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function ParentTuitionFeesPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildWithFees[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useRealtimeSubscription({
    table: 'tuition_fees',
    event: '*',
    onData: () => loadChildrenWithFees(),
    enabled: true,
  });

  useRealtimeSubscription({
    table: 'payment_schedules',
    event: '*',
    onData: () => loadChildrenWithFees(),
    enabled: true,
  });

  useEffect(() => {
    if (user?.id) {
      loadChildrenWithFees();
    }
  }, [user]);

  const loadChildrenWithFees = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Récupérer les enfants du parent
      const { data: parentsStudents, error: psError } = await supabase
        .from('parents_students')
        .select('student_id')
        .eq('parent_id', user.id);

      if (psError) throw psError;

      const studentIds = parentsStudents?.map(ps => ps.student_id) || [];

      if (studentIds.length === 0) {
        setChildren([]);
        setIsLoading(false);
        return;
      }

      // Récupérer les informations des élèves avec leurs classes
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, matricule, class_id, classes(name, level)')
        .in('id', studentIds)
        .is('deleted_at', null);

      if (studentsError) throw studentsError;

      // Pour chaque élève, récupérer les frais de scolarité
      const childrenWithFees: ChildWithFees[] = await Promise.all(
        (studentsData || []).map(async (student: any) => {
          if (!student.class_id) {
            return {
              ...student,
              class: student.classes || { name: 'Non assigné', level: '' },
              tuitionFee: null,
              paymentSchedules: [],
            };
          }

          // Récupérer les frais de scolarité pour la classe de l'élève
          const { data: feeData, error: feeError } = await supabase
            .from('tuition_fees')
            .select('*')
            .eq('class_id', student.class_id)
            .eq('school_id', user.school_id)
            .order('academic_year', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (feeError && feeError.code !== 'PGRST116') {
            console.error('Error loading fee:', feeError);
          }

          let schedules: PaymentSchedule[] = [];
          if (feeData) {
            // Récupérer les échéanciers
            const { data: schedulesData, error: schedulesError } = await supabase
              .from('payment_schedules')
              .select('*')
              .eq('tuition_fee_id', feeData.id)
              .order('installment_number');

            if (schedulesError) {
              console.error('Error loading schedules:', schedulesError);
            } else {
              schedules = schedulesData || [];
            }
          }

          return {
            ...student,
            class: student.classes || { name: 'Non assigné', level: '' },
            tuitionFee: feeData || null,
            paymentSchedules: schedules,
          };
        })
      );

      setChildren(childrenWithFees);
      if (childrenWithFees.length > 0 && !selectedChildId) {
        setSelectedChildId(childrenWithFees[0].id);
      }
    } catch (error) {
      console.error('Error loading children fees:', error);
      toast.error('Erreur lors du chargement des frais');
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

  const selectedChild = children.find(c => c.id === selectedChildId);

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
          <h1 className="text-3xl font-bold text-gray-900">Frais de scolarité</h1>
          <p className="text-gray-600 mt-2">Consultez les frais et échéanciers de paiement</p>
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
        <h1 className="text-3xl font-bold text-gray-900">Frais de scolarité</h1>
        <p className="text-gray-600 mt-2">Consultez les frais et échéanciers de paiement de vos enfants</p>
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
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedChildId === child.id
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {child.first_name} {child.last_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{child.class.name}</p>
                  </div>
                  {selectedChildId === child.id && (
                    <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                      <Icons.Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-mono text-primary-600">{child.matricule}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Détails des frais pour l'enfant sélectionné */}
      {selectedChild && (
        <div className="space-y-6">
          {!selectedChild.tuitionFee ? (
            <Card>
              <CardContent className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun frais défini
                </h3>
                <p className="text-gray-600">
                  Les frais de scolarité pour la classe <strong>{selectedChild.class.name}</strong> n'ont pas encore été définis par l'administration.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Résumé des frais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Frais de scolarité - {selectedChild.first_name} {selectedChild.last_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Frais annuels</p>
                          <p className="text-3xl font-bold text-primary-600">
                            {formatCurrency(selectedChild.tuitionFee.total_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Frais d'inscription</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {formatCurrency(selectedChild.tuitionFee.registration_fee)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Autres frais</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {formatCurrency(selectedChild.tuitionFee.other_fees)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-primary-300 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Classe :</strong> {selectedChild.class.name}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Année scolaire :</strong> {selectedChild.tuitionFee.academic_year}
                          </p>
                        </div>
                        {selectedChild.tuitionFee.description && (
                          <div>
                            <p className="text-sm text-gray-700">
                              <strong>Description :</strong> {selectedChild.tuitionFee.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Échéanciers de paiement */}
              {selectedChild.paymentSchedules.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Échéancier de paiement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedChild.paymentSchedules.map((schedule, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                              <span className="text-primary-600 font-bold text-lg">
                                {schedule.installment_number}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {schedule.description || `Tranche ${schedule.installment_number}`}
                              </p>
                              <p className="text-sm text-gray-600 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {MONTHS[schedule.due_month - 1]}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary-600">
                              {formatCurrency(schedule.amount)}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Total */}
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm text-gray-600">Total échelonné</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {selectedChild.paymentSchedules.length} versement(s)
                            </p>
                          </div>
                          <p className="text-3xl font-bold text-primary-600">
                            {formatCurrency(
                              selectedChild.paymentSchedules.reduce((sum, s) => sum + s.amount, 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Note d'information */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Icons.AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-2">Information importante</h4>
                      <p className="text-sm text-blue-800">
                        Pour effectuer un paiement, veuillez contacter le secrétariat ou le comptable de l'école.
                        Les paiements peuvent être effectués en espèces, par chèque ou par virement bancaire.
                      </p>
                      {selectedChild.paymentSchedules.length > 0 && (
                        <p className="text-sm text-blue-800 mt-2">
                          Veillez à respecter les dates d'échéance pour éviter les pénalités de retard.
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
