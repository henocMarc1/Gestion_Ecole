'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface Reminder {
  id: string;
  student_name: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  amount_due: number;
  days_overdue: number;
  last_reminder_date: string | null;
}

export default function PaymentRemindersPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [user]);

  async function loadReminders() {
    try {
      if (!user?.school_id) return;
      setIsLoading(true);

      // Charger les factures en retard
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          total,
          due_date,
          student_id
        `)
        .eq('school_id', user.school_id)
        .eq('status', 'OVERDUE')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Charger les infos des étudiants et parents séparément
      const reminderList: Reminder[] = [];
      
      for (const inv of invoices || []) {
        // Récupérer l'étudiant
        const { data: student } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('id', inv.student_id)
          .single();

        // Récupérer le parent principal via parents_students
        const { data: parentLink } = await supabase
          .from('parents_students')
          .select('parent:users(id, full_name, email, phone)')
          .eq('student_id', inv.student_id)
          .eq('is_primary_contact', true)
          .single();

        const dueDate = new Date(inv.due_date);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        reminderList.push({
          id: inv.id,
          student_name: student ? `${student.first_name} ${student.last_name}` : 'Inconnu',
          parent_name: (parentLink?.parent as any)?.full_name || 'Inconnu',
          parent_email: (parentLink?.parent as any)?.email || '-',
          parent_phone: (parentLink?.parent as any)?.phone || '-',
          amount_due: inv.total,
          days_overdue: daysOverdue,
          last_reminder_date: null,
        });
      }

      setReminders(reminderList);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des relances');
    } finally {
      setIsLoading(false);
    }
  }

  async function sendReminder(reminderId: string) {
    try {
      setIsSending(true);
      
      // Dans une vraie application, vous enverriez un SMS/Email ici
      // Pour l'instant, on simule l'envoi
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Relance envoyée avec succès');
      await loadReminders();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi de la relance');
    } finally {
      setIsSending(false);
    }
  }

  async function sendAllReminders() {
    try {
      setIsSending(true);
      
      // Simuler l'envoi de toutes les relances
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success(`${reminders.length} relances envoyées avec succès`);
      await loadReminders();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi des relances');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Relances de paiement</h1>
          <p className="text-sm text-neutral-600">Gérez les relances pour les paiements en retard</p>
        </div>
        <Button 
          onClick={sendAllReminders}
          disabled={isSending || reminders.length === 0}
        >
          <Icons.Mail className="h-4 w-4 mr-2" />
          Envoyer toutes les relances
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Icons.AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Paiements en retard</p>
              <p className="text-2xl font-bold text-neutral-900">{reminders.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Icons.DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Montant total dû</p>
              <p className="text-2xl font-bold text-neutral-900">
                {formatCurrency(reminders.reduce((sum, r) => sum + r.amount_due, 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Icons.Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Retard moyen</p>
              <p className="text-2xl font-bold text-neutral-900">
                {reminders.length > 0 
                  ? Math.round(reminders.reduce((sum, r) => sum + r.days_overdue, 0) / reminders.length)
                  : 0} jours
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Liste des relances */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Élève</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Parent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Montant dû</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Retard</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                    Chargement...
                  </td>
                </tr>
              ) : reminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                    Aucune relance nécessaire
                  </td>
                </tr>
              ) : (
                reminders.map((reminder) => (
                  <tr key={reminder.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                      {reminder.student_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {reminder.parent_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      <div>
                        <p>{reminder.parent_email}</p>
                        <p className="text-xs text-neutral-500">{reminder.parent_phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-red-600">
                      {formatCurrency(reminder.amount_due)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        reminder.days_overdue > 30 ? 'bg-red-100 text-red-700' :
                        reminder.days_overdue > 15 ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {reminder.days_overdue} jours
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendReminder(reminder.id)}
                        disabled={isSending}
                      >
                        <Icons.Mail className="h-4 w-4 mr-1" />
                        Envoyer
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
