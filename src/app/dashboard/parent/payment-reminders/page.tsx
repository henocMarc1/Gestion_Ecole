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
  student_id: string;
  student_name: string;
  student_matricule: string;
  class_name: string;
  class_level: string;
  month: number;
  year: number;
  due_date: string;
  days_overdue: number;
  amount_due: number;
  reminder_level: 1 | 2 | 3;
  status: 'sent' | 'paid' | 'ignored' | 'excluded';
  sent_at: string;
  excluded_at: string | null;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function ParentPaymentRemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadReminders();
    }
  }, [user?.id]);

  const loadReminders = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('active_payment_reminders')
        .select('*')
        .eq('parent_id', user?.id)
        .order('days_overdue', { ascending: false });

      if (error) throw error;

      setReminders(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const getReminderLevelInfo = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return {
          icon: '⚠️',
          title: 'Premier rappel',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          message: 'Retard de 1 à 14 jours',
        };
      case 2:
        return {
          icon: '🔔',
          title: 'Deuxième rappel',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          message: 'Retard de 15 à 29 jours',
        };
      case 3:
        return {
          icon: '❌',
          title: 'EXCLUSION',
          color: 'bg-red-100 text-red-800 border-red-200',
          message: 'Retard de 30+ jours - Votre enfant a été exclu de la classe',
        };
      default:
        return {
          icon: '📄',
          title: 'Rappel',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          message: '',
        };
    }
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

  const activeReminders = reminders.filter(r => r.status === 'sent' || r.status === 'excluded');
  const paidReminders = reminders.filter(r => r.status === 'paid');

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            ⏰ Rappels de Paiement
          </h1>
          <p className="text-neutral-600">
            Consultez les échéances de paiement et régularisez votre situation
          </p>
        </div>

        {/* Urgent Alert */}
        {activeReminders.some(r => r.reminder_level === 3) && (
          <Card className="mb-8 p-6 bg-red-50 border-red-300">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🚨</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-900 mb-2">
                  ATTENTION : Exclusion de classe
                </h3>
                <p className="text-red-800 mb-4">
                  Votre enfant a été exclu de sa classe en raison d'un retard de paiement de plus de 30 jours.
                  Veuillez régulariser votre situation au plus vite pour réintégrer votre enfant.
                </p>
                <Button className="bg-red-600 hover:bg-red-700 text-white">
                  <Icons.Phone className="w-4 h-4 mr-2" />
                  Contacter l'administration
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-white">
            <div className="text-center">
              <p className="text-3xl mb-1">📊</p>
              <p className="text-xs text-neutral-600 mb-1">Total</p>
              <p className="text-2xl font-bold text-neutral-900">{reminders.length}</p>
            </div>
          </Card>
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="text-center">
              <p className="text-3xl mb-1">⚠️</p>
              <p className="text-xs text-neutral-600 mb-1">1er Rappel</p>
              <p className="text-2xl font-bold text-yellow-600">
                {reminders.filter(r => r.reminder_level === 1).length}
              </p>
            </div>
          </Card>
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="text-center">
              <p className="text-3xl mb-1">🔔</p>
              <p className="text-xs text-neutral-600 mb-1">2e Rappel</p>
              <p className="text-2xl font-bold text-orange-600">
                {reminders.filter(r => r.reminder_level === 2).length}
              </p>
            </div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="text-center">
              <p className="text-3xl mb-1">❌</p>
              <p className="text-xs text-neutral-600 mb-1">Exclusions</p>
              <p className="text-2xl font-bold text-red-600">
                {reminders.filter(r => r.reminder_level === 3).length}
              </p>
            </div>
          </Card>
        </div>

        {/* Active Reminders */}
        {activeReminders.length > 0 && (
          <Card className="mb-8">
            <div className="p-6 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">
                🔔 Rappels actifs ({activeReminders.length})
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {activeReminders.map((reminder) => {
                const levelInfo = getReminderLevelInfo(reminder.reminder_level);
                return (
                  <Card
                    key={reminder.id}
                    className={`p-6 border-2 ${levelInfo.color}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-5xl">{levelInfo.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-xl font-bold mb-1">{levelInfo.title}</h4>
                            <p className="text-sm font-semibold">{levelInfo.message}</p>
                          </div>
                          <span className="text-2xl font-bold">
                            {Number(reminder.amount_due).toLocaleString()} XOF
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-neutral-600">Élève</p>
                            <p className="font-semibold">{reminder.student_name}</p>
                            <p className="text-xs text-neutral-500">{reminder.student_matricule}</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-600">Classe</p>
                            <p className="font-semibold">{reminder.class_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-600">Mois</p>
                            <p className="font-semibold">{MONTHS[reminder.month - 1]} {reminder.year}</p>
                          </div>
                          <div>
                            <p className="text-xs text-neutral-600">Retard</p>
                            <p className="font-bold text-red-600">{reminder.days_overdue} jours</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button className="bg-green-600 hover:bg-green-700 text-white">
                            <Icons.DollarSign className="w-4 h-4 mr-2" />
                            Payer maintenant
                          </Button>
                          {reminder.reminder_level === 3 && (
                            <Button variant="outline">
                              <Icons.Phone className="w-4 h-4 mr-2" />
                              Contacter l'école
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        )}

        {/* No Active Reminders */}
        {activeReminders.length === 0 && (
          <Card className="p-12 text-center bg-green-50 border-green-200">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-green-900 mb-2">
              Aucun rappel actif
            </h3>
            <p className="text-green-700">
              Tous vos paiements sont à jour. Merci pour votre ponctualité !
            </p>
          </Card>
        )}

        {/* Paid Reminders History */}
        {paidReminders.length > 0 && (
          <Card className="mt-8">
            <div className="p-6 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">
                ✅ Historique des paiements ({paidReminders.length})
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
                      Période
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {paidReminders.map((reminder) => (
                    <tr key={reminder.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium text-neutral-900">{reminder.student_name}</p>
                          <p className="text-xs text-neutral-500">{reminder.class_name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-neutral-900">
                          {MONTHS[reminder.month - 1]} {reminder.year}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-semibold text-neutral-900">
                          {Number(reminder.amount_due).toLocaleString()} XOF
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                          ✅ Payé
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Information Card */}
        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <h4 className="font-bold text-blue-900 mb-3">💡 Comment fonctionne le système ?</h4>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>⚠️ <strong>1-14 jours de retard</strong> : Premier rappel (vous êtes ici)</li>
            <li>🔔 <strong>15-29 jours de retard</strong> : Deuxième rappel (urgent)</li>
            <li>❌ <strong>30+ jours de retard</strong> : Exclusion automatique de la classe</li>
            <li>💰 <strong>Pour régulariser</strong> : Cliquez sur "Payer maintenant" ou contactez le secrétariat</li>
            <li>📞 <strong>Besoin d'aide ?</strong> : Contactez l'administration pour un échéancier personnalisé</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
