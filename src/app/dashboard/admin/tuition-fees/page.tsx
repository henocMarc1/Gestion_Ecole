'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DollarSign, Plus, Edit2, Trash2, Calendar, Save, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { notifyTuitionFeeCreated } from '@/lib/notificationHelpers';

interface Class {
  id: string;
  name: string;
  level: string;
}

interface TuitionFee {
  id: string;
  classId: string;
  className: string;
  academicYear: string;
  totalAmount: number;
  registrationFee: number;
  otherFees: number;
  description: string;
}

interface PaymentSchedule {
  id: string;
  tuitionFeeId: string;
  installmentNumber: number;
  dueMonth: number;
  amount: number;
  description: string;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function AdminTuitionFeesPage() {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [tuitionFees, setTuitionFees] = useState<TuitionFee[]>([]);
  const [selectedTuitionFee, setSelectedTuitionFee] = useState<string | null>(null);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFee, setEditingFee] = useState<string | null>(null);

  const [newFee, setNewFee] = useState({
    classId: '',
    academicYear: '2025-2026',
    totalAmount: '',
    registrationFee: '',
    otherFees: '',
    description: '',
  });

  const [newSchedule, setNewSchedule] = useState({
    installmentNumber: 1,
    dueMonth: 9,
    amount: '',
    description: '1ère tranche',
  });

  useRealtimeSubscription({
    table: 'tuition_fees',
    event: '*',
    onData: () => {
      loadTuitionFees();
      if (selectedTuitionFee) {
        loadPaymentSchedules(selectedTuitionFee);
      }
    },
    enabled: true,
  });
  
  useRealtimeSubscription({
    table: 'payment_schedules',
    event: '*',
    onData: () => {
      if (selectedTuitionFee) {
        loadPaymentSchedules(selectedTuitionFee);
      }
    },
    enabled: !!selectedTuitionFee,
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(data);
      }
    };
    getCurrentUser();
  }, []);

  const loadClasses = async () => {
    try {
      if (!currentUser) return;

      const { data } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', currentUser.school_id)
        .is('deleted_at', null)
        .order('level, name');

      if (data) {
        setClasses(data);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadTuitionFees = async () => {
    try {
      if (!currentUser) return;

      const { data } = await supabase
        .from('tuition_fees')
        .select('id, class_id, academic_year, total_amount, registration_fee, other_fees, description, classes(name)')
        .eq('school_id', currentUser.school_id)
        .order('academic_year', { ascending: false });

      if (data) {
        const formatted = data.map((tf: any) => ({
          id: tf.id,
          classId: tf.class_id,
          className: tf.classes?.name || 'N/A',
          academicYear: tf.academic_year,
          totalAmount: tf.total_amount,
          registrationFee: tf.registration_fee,
          otherFees: tf.other_fees,
          description: tf.description,
        }));
        setTuitionFees(formatted);
      }
    } catch (error) {
      console.error('Error loading tuition fees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentSchedules = async (tuitionFeeId: string) => {
    try {
      const { data } = await supabase
        .from('payment_schedules')
        .select('*')
        .eq('tuition_fee_id', tuitionFeeId)
        .order('installment_number');

      if (data) {
        setPaymentSchedules(data.map((ps: any) => ({
          id: ps.id,
          tuitionFeeId: ps.tuition_fee_id,
          installmentNumber: ps.installment_number,
          dueMonth: ps.due_month,
          amount: ps.amount,
          description: ps.description,
        })));
      }
    } catch (error) {
      console.error('Error loading payment schedules:', error);
    }
  };

  const handleSaveFee = async () => {
    if (!newFee.classId || !newFee.totalAmount) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSaving(true);
    try {
      const feeData = {
        school_id: currentUser.school_id,
        class_id: newFee.classId,
        academic_year: newFee.academicYear,
        total_amount: parseFloat(newFee.totalAmount),
        registration_fee: parseFloat(newFee.registrationFee) || 0,
        other_fees: parseFloat(newFee.otherFees) || 0,
        description: newFee.description,
      };

      if (editingFee) {
        await supabase
          .from('tuition_fees')
          .update(feeData)
          .eq('id', editingFee);
      } else {
        const { data: newFeeData } = await supabase
          .from('tuition_fees')
          .insert(feeData)
          .select()
          .single();

        // Notify parents about new tuition fee
        if (newFeeData && currentUser) {
          try {
            await notifyTuitionFeeCreated(
              currentUser.school_id,
              `Frais scolaires ${newFee.academicYear}`,
              newFee.classId,
              parseFloat(newFee.totalAmount)
            );
          } catch (notifError) {
            console.warn('Avertissement - Notification non créée:', notifError);
          }
        }
      }

      setNewFee({
        classId: '',
        academicYear: '2025-2026',
        totalAmount: '',
        registrationFee: '',
        otherFees: '',
        description: '',
      });
      setEditingFee(null);
      setShowAddForm(false);
      await loadTuitionFees();
    } catch (error) {
      console.error('Error saving fee:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFee = async (feeId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ces frais ? Les échéanciers associés seront également supprimés.')) return;

    try {
      await supabase.from('tuition_fees').delete().eq('id', feeId);
      await loadTuitionFees();
    } catch (error) {
      console.error('Error deleting fee:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedTuitionFee || !newSchedule.amount) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    try {
      await supabase.from('payment_schedules').insert({
        tuition_fee_id: selectedTuitionFee,
        installment_number: newSchedule.installmentNumber,
        due_month: newSchedule.dueMonth,
        amount: parseFloat(newSchedule.amount),
        description: newSchedule.description,
      });

      setNewSchedule({
        installmentNumber: newSchedule.installmentNumber + 1,
        dueMonth: newSchedule.dueMonth + 1 > 12 ? 1 : newSchedule.dueMonth + 1,
        amount: '',
        description: `${newSchedule.installmentNumber + 1}ère tranche`,
      });

      await loadPaymentSchedules(selectedTuitionFee);
    } catch (error: any) {
      console.error('Error adding schedule:', error);
      alert(error.message || 'Erreur lors de l\'ajout de l\'échéancier');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet échéancier ?')) return;

    try {
      await supabase.from('payment_schedules').delete().eq('id', scheduleId);
      if (selectedTuitionFee) {
        await loadPaymentSchedules(selectedTuitionFee);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadClasses();
      loadTuitionFees();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedTuitionFee) {
      loadPaymentSchedules(selectedTuitionFee);
    }
  }, [selectedTuitionFee]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Frais de Scolarité</h1>
          <p className="text-gray-600 mt-2">Gérer les frais et les échéanciers de paiement</p>
        </div>
        <Button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingFee(null);
            setNewFee({
              classId: '',
              academicYear: '2025-2026',
              totalAmount: '',
              registrationFee: '',
              otherFees: '',
              description: '',
            });
          }}
          className="bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showAddForm ? 'Annuler' : 'Ajouter des frais'}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingFee ? 'Modifier les frais' : 'Ajouter des frais de scolarité'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classe *
                </label>
                <select
                  value={newFee.classId}
                  onChange={(e) => setNewFee({ ...newFee, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  disabled={editingFee !== null}
                >
                  <option value="">Sélectionner une classe</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Année scolaire *
                </label>
                <Input
                  type="text"
                  placeholder="ex: 2025-2026"
                  value={newFee.academicYear}
                  onChange={(e) => setNewFee({ ...newFee, academicYear: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant total annuel (FCFA) *
                </label>
                <Input
                  type="number"
                  placeholder="ex: 500000"
                  value={newFee.totalAmount}
                  onChange={(e) => setNewFee({ ...newFee, totalAmount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frais d'inscription (FCFA)
                </label>
                <Input
                  type="number"
                  placeholder="ex: 25000"
                  value={newFee.registrationFee}
                  onChange={(e) => setNewFee({ ...newFee, registrationFee: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Autres frais (FCFA)
                </label>
                <Input
                  type="number"
                  placeholder="ex: 15000"
                  value={newFee.otherFees}
                  onChange={(e) => setNewFee({ ...newFee, otherFees: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <Input
                  type="text"
                  placeholder="Description des frais (optionnel)"
                  value={newFee.description}
                  onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleSaveFee}
                disabled={isSaving}
                className="bg-primary-600 hover:bg-primary-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingFee ? 'Modifier' : 'Enregistrer'}
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingFee(null);
                }}
                variant="outline"
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Frais par classe</CardTitle>
          </CardHeader>
          <CardContent>
            {tuitionFees.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun frais défini</p>
            ) : (
              <div className="space-y-3">
                {tuitionFees.map((fee) => (
                  <div
                    key={fee.id}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedTuitionFee === fee.id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedTuitionFee(fee.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{fee.className}</h3>
                        <p className="text-sm text-gray-600">{fee.academicYear}</p>
                        <p className="text-lg font-bold text-primary-600 mt-2">
                          {formatCurrency(fee.totalAmount)}
                        </p>
                        {(fee.registrationFee > 0 || fee.otherFees > 0) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {fee.registrationFee > 0 && (
                              <span>Inscription: {formatCurrency(fee.registrationFee)}</span>
                            )}
                            {fee.registrationFee > 0 && fee.otherFees > 0 && ' • '}
                            {fee.otherFees > 0 && (
                              <span>Autres: {formatCurrency(fee.otherFees)}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFee(fee.id);
                            setNewFee({
                              classId: fee.classId,
                              academicYear: fee.academicYear,
                              totalAmount: fee.totalAmount.toString(),
                              registrationFee: fee.registrationFee.toString(),
                              otherFees: fee.otherFees.toString(),
                              description: fee.description,
                            });
                            setShowAddForm(true);
                          }}
                          className="text-primary-600 hover:text-primary-700 p-1 hover:bg-primary-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFee(fee.id);
                          }}
                          className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Échéanciers de paiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTuitionFee ? (
              <p className="text-gray-500 text-center py-8">
                Sélectionnez des frais pour voir les échéanciers
              </p>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-900">Ajouter une tranche</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        N° tranche
                      </label>
                      <Input
                        type="number"
                        value={newSchedule.installmentNumber}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            installmentNumber: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Mois d'échéance
                      </label>
                      <select
                        value={newSchedule.dueMonth}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            dueMonth: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={idx} value={idx + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Montant (FCFA)
                      </label>
                      <Input
                        type="number"
                        placeholder="ex: 50000"
                        value={newSchedule.amount}
                        onChange={(e) => setNewSchedule({ ...newSchedule, amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <Input
                        type="text"
                        value={newSchedule.description}
                        onChange={(e) =>
                          setNewSchedule({ ...newSchedule, description: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddSchedule}
                    size="sm"
                    className="w-full bg-primary-600 hover:bg-primary-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter la tranche
                  </Button>
                </div>

                {paymentSchedules.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucun échéancier défini</p>
                ) : (
                  <div className="space-y-2">
                    {paymentSchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {schedule.description || `Tranche ${schedule.installmentNumber}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            {MONTHS[schedule.dueMonth - 1]} •{' '}
                            {formatCurrency(schedule.amount)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total échelonné :</span>
                        <span className="text-lg font-bold text-primary-600">
                          {formatCurrency(
                            paymentSchedules.reduce((sum, s) => sum + s.amount, 0)
                          )}
                        </span>
                      </div>
                      {selectedTuitionFee && (
                        <div className="text-sm text-gray-600 mt-1">
                          Montant annuel :{' '}
                          {formatCurrency(
                            tuitionFees.find((f) => f.id === selectedTuitionFee)?.totalAmount || 0
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
