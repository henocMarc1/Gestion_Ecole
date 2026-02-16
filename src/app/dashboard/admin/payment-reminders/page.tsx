'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';

interface PaymentReminder {
  id: string;
  student_name: string;
  student_matricule: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  class_name: string;
  class_level: string;
  month: number;
  year: number;
  due_date: string;
  days_overdue: number;
  amount_due: number;
  reminder_level: 1 | 2 | 3;
  status: 'sent' | 'paid' | 'ignored' | 'excluded';
  notification_sent: boolean;
  sent_at: string;
  excluded_at: string | null;
}

interface ClassStats {
  class_id: string;
  class_name: string;
  payment_due_day: number;
  students_overdue: number;
  level_1_count: number;
  level_2_count: number;
  excluded_count: number;
  total_amount_due: number;
  avg_days_overdue: number;
}

export default function PaymentRemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [classStats, setClassStats] = useState<ClassStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (user?.school_id) {
      loadData();
    }
  }, [user?.school_id]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Charger les rappels actifs
      const { data: remindersData, error: remindersError } = await supabase
        .from('active_payment_reminders')
        .select('*')
        .eq('school_id', user?.school_id)
        .order('days_overdue', { ascending: false });

      if (remindersError) throw remindersError;
      setReminders(remindersData || []);

      // Charger les statistiques par classe
      const { data: statsData, error: statsError } = await supabase
        .from('payment_overdue_stats')
        .select('*');

      if (statsError) throw statsError;
      setClassStats(statsData || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOverduePayments = async () => {
    try {
      setIsProcessing(true);
      
      // Appeler la fonction SQL
      const { data, error } = await supabase.rpc('create_payment_reminders');

      if (error) throw error;

      toast.success(`${data || 0} rappels créés`);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la vérification des paiements');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoExclude = async () => {
    if (!confirm('Êtes-vous sûr de vouloir exclure automatiquement les étudiants en retard de 30+ jours ?')) {
      return;
    }

    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.rpc('auto_exclude_students');

      if (error) throw error;

      toast.success(`${data || 0} étudiants exclus`);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'exclusion');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendNotifications = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.rpc('send_payment_notifications');

      if (error) throw error;

      toast.success(`${data || 0} notifications envoyées`);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi des notifications');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAsPaid = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('payment_reminders')
        .update({ 
          status: 'paid', 
          paid_at: new Date().toISOString() 
        })
        .eq('id', reminderId);

      if (error) throw error;

      toast.success('Marqué comme payé');
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredReminders = reminders.filter(r => {
    if (filterLevel !== 'all' && r.reminder_level.toString() !== filterLevel) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const totalStats = {
    total: reminders.length,
    level1: reminders.filter(r => r.reminder_level === 1).length,
    level2: reminders.filter(r => r.reminder_level === 2).length,
    excluded: reminders.filter(r => r.reminder_level === 3).length,
    totalAmount: reminders.reduce((sum, r) => sum + Number(r.amount_due), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Icons.Clock className="w-12 h-12 mx-auto mb-4 animate-spin" />
          <p className="text-neutral-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            ⏰ Rappels de Paiement
          </h1>
          <p className="text-neutral-600">
            Système automatique de rappels avec exclusion progressive (1-15j → 15-29j → 30j+)
          </p>
        </div>

        {/* Actions */}
        <Card className="mb-8 p-6">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleCheckOverduePayments}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Icons.Clock className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <Icons.Activity className="w-4 h-4 mr-2" />
                  Vérifier les retards
                </>
              )}
            </Button>

            <Button 
              onClick={handleSendNotifications}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Icons.Bell className="w-4 h-4 mr-2" />
              Envoyer notifications
            </Button>

            <Button 
              onClick={handleAutoExclude}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Icons.X className="w-4 h-4 mr-2" />
              Exclure automatiquement
            </Button>

            <Button 
              onClick={loadData}
              disabled={isLoading}
              variant="outline"
            >
              <Icons.Activity className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </Card>

        {/* Global Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="text-center">
              <p className="text-3xl mb-1">📊</p>
              <p className="text-xs text-neutral-600 mb-1">Total</p>
              <p className="text-2xl font-bold text-blue-600">{totalStats.total}</p>
            </div>
          </Card>
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="text-center">
              <p className="text-3xl mb-1">⚠️</p>
              <p className="text-xs text-neutral-600 mb-1">1er Rappel</p>
              <p className="text-2xl font-bold text-yellow-600">{totalStats.level1}</p>
            </div>
          </Card>
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="text-center">
              <p className="text-3xl mb-1">🔔</p>
              <p className="text-xs text-neutral-600 mb-1">2e Rappel</p>
              <p className="text-2xl font-bold text-orange-600">{totalStats.level2}</p>
            </div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="text-center">
              <p className="text-3xl mb-1">❌</p>
              <p className="text-xs text-neutral-600 mb-1">Exclus</p>
              <p className="text-2xl font-bold text-red-600">{totalStats.excluded}</p>
            </div>
          </Card>
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="text-center">
              <p className="text-3xl mb-1">💰</p>
              <p className="text-xs text-neutral-600 mb-1">Montant dû</p>
              <p className="text-xl font-bold text-green-600">
                {totalStats.totalAmount.toLocaleString()} XOF
              </p>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Niveau de rappel
              </label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les niveaux</option>
                <option value="1">⚠️ 1er Rappel (1-15 jours)</option>
                <option value="2">🔔 2e Rappel (15-29 jours)</option>
                <option value="3">❌ Exclusion (30+ jours)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Statut
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="sent">📤 Envoyé</option>
                <option value="paid">✅ Payé</option>
                <option value="excluded">❌ Exclu</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Reminders Table */}
        <Card>
          <div className="p-6 border-b border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900">
              📋 Liste des rappels ({filteredReminders.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Élève
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Classe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Retard
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Niveau
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredReminders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                      Aucun rappel pour les critères sélectionnés
                    </td>
                  </tr>
                ) : (
                  filteredReminders.map((reminder) => (
                    <tr key={reminder.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium text-neutral-900">
                            {reminder.student_name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {reminder.student_matricule}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm text-neutral-900">{reminder.parent_name}</p>
                          <p className="text-xs text-neutral-500">{reminder.parent_phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-neutral-900">
                          {reminder.class_name}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`font-bold ${
                          reminder.days_overdue >= 30 ? 'text-red-600' :
                          reminder.days_overdue >= 15 ? 'text-orange-600' :
                          'text-yellow-600'
                        }`}>
                          {reminder.days_overdue} jours
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          reminder.reminder_level === 1 ? 'bg-yellow-100 text-yellow-800' :
                          reminder.reminder_level === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {reminder.reminder_level === 1 ? '⚠️ 1er' :
                           reminder.reminder_level === 2 ? '🔔 2e' :
                           '❌ Exclusion'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-semibold text-neutral-900">
                          {Number(reminder.amount_due).toLocaleString()} XOF
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          reminder.status === 'paid' ? 'bg-green-100 text-green-800' :
                          reminder.status === 'excluded' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {reminder.status === 'paid' ? '✅ Payé' :
                           reminder.status === 'excluded' ? '❌ Exclu' :
                           '📤 Envoyé'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {reminder.status === 'sent' && (
                          <button
                            onClick={() => handleMarkAsPaid(reminder.id)}
                            className="text-green-600 hover:text-green-800 font-medium text-sm"
                          >
                            ✅ Marquer payé
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Class Statistics */}
        {classStats.length > 0 && (
          <Card className="mt-8">
            <div className="p-6 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">
                📊 Statistiques par classe
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classStats.map((stat) => (
                  <div key={stat.class_id} className="border border-neutral-200 rounded-lg p-4">
                    <h4 className="font-bold text-neutral-900 mb-2">{stat.class_name}</h4>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-neutral-600">Échéance:</span>{' '}
                        <span className="font-semibold">Chaque {stat.payment_due_day} du mois</span>
                      </p>
                      <p>
                        <span className="text-neutral-600">En retard:</span>{' '}
                        <span className="font-semibold text-red-600">{stat.students_overdue}</span>
                      </p>
                      <p>
                        <span className="text-neutral-600">Montant dû:</span>{' '}
                        <span className="font-semibold">{Number(stat.total_amount_due).toLocaleString()} XOF</span>
                      </p>
                      <p>
                        <span className="text-neutral-600">Retard moyen:</span>{' '}
                        <span className="font-semibold">{Math.round(stat.avg_days_overdue || 0)} jours</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
