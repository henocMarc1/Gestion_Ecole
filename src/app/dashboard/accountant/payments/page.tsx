'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/helpers';

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  status: string;
  transaction_id?: string;
  created_at: string;
  invoice?: {
    total: number;
    student?: { first_name: string; last_name: string };
  };
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    invoice_id: '',
    amount: '',
    payment_method: 'BANK_TRANSFER',
    transaction_id: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  // Abonnement aux changements des paiements
  useRealtimeSubscription({
    table: 'payments',
    event: '*',
    filter: `school_id=eq.${user?.school_id}`,
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!user?.school_id,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newPayment = payload.new as Payment;
    const oldPayment = payload.old as Payment;

    switch (payload.eventType) {
      case 'INSERT':
        setPayments(prev => [newPayment, ...prev]);
        toast.success('Nouveau paiement enregistré');
        break;
      case 'UPDATE':
        setPayments(prev =>
          prev.map(pay => pay.id === newPayment.id ? { ...pay, ...newPayment } : pay)
        );
        toast.success('Paiement mis à jour');
        break;
      case 'DELETE':
        setPayments(prev => prev.filter(pay => pay.id !== oldPayment.id));
        toast.success('Paiement supprimé');
        break;
    }
  };

  const loadData = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const [paymentsRes, invoicesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, invoice:invoices(student:students(first_name, last_name))')
          .eq('school_id', user.school_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, total, student:students(first_name, last_name)')
          .eq('school_id', user.school_id)
          .neq('status', 'PAID')
          .is('deleted_at', null),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      setPayments(paymentsRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoice_id || !formData.amount) {
      toast.error('Tous les champs requis');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('payments').insert([{
        school_id: user?.school_id,
        student_id: invoices.find(i => i.id === formData.invoice_id)?.student_id || '', // Get student_id from invoice
        invoice_id: formData.invoice_id,
        payment_number: `PAY-${Date.now()}`,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        transaction_id: formData.transaction_id || null,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'COMPLETED',
      }]);

      if (error) throw error;

      // Mettre à jour le statut de la facture si entièrement payée
      const invoice = invoices.find(i => i.id === formData.invoice_id);
      if (invoice && parseFloat(formData.amount) >= invoice.total) {
        await supabase
          .from('invoices')
          .update({ status: 'PAID' })
          .eq('id', formData.invoice_id);
      }

      toast.success('Paiement enregistré');
      setFormData({ invoice_id: '', amount: '', payment_method: 'BANK_TRANSFER', transaction_id: '' });
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const stats = {
    totalPayments: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Gestion des paiements</h1>
        <p className="text-sm text-neutral-600 mt-1">Enregistrez et suivez les paiements des factures</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Paiements enregistrés</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.totalPayments}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Total collecté</p>
          <p className="text-2xl font-bold text-success-600">{formatCurrency(stats.totalAmount)}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Factures en attente</p>
          <p className="text-2xl font-bold text-warning-600">{invoices.length}</p>
        </Card>
      </div>

      {/* Formulaire */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Enregistrer un paiement</h2>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select
                value={formData.invoice_id}
                onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sélectionner une facture</option>
                {invoices.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.student?.first_name} {i.student?.last_name} - {formatCurrency(i.total)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Montant du paiement"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="BANK_TRANSFER">Virement bancaire</option>
                <option value="CASH">Espèces</option>
                <option value="CHECK">Chèque</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
              <input
                type="text"
                placeholder="ID de transaction (optionnel)"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </Button>
          </form>
        </div>
      </Card>

      {/* Liste */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : payments.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.CreditCard className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun paiement</h3>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Élève</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Méthode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">ID Transaction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {payment.invoice?.student?.first_name} {payment.invoice?.student?.last_name}
                    </td>
                    <td className="px-4 py-3 font-semibold text-success-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {payment.payment_method === 'BANK_TRANSFER' ? 'Virement' : payment.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : payment.payment_method}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-neutral-600">{payment.transaction_id || '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(payment.created_at).toLocaleDateString('fr-FR')}
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
