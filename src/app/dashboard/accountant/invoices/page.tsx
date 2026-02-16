'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/helpers';

interface Invoice {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
  student?: { first_name: string; last_name: string };
}

export default function InvoicesAccountantPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    loadInvoices();
  }, [user, filterStatus]);

  // Abonnement aux changements des factures
  useRealtimeSubscription({
    table: 'invoices',
    event: '*',
    filter: `school_id=eq.${user?.school_id}`,
    onData: () => {
      loadInvoices();
    },
    enabled: !!user?.school_id,
  });

  const loadInvoices = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, student:students(first_name, last_name)')
        .eq('school_id', user.school_id)
        .is('deleted_at', null);

      if (filterStatus !== 'ALL') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'PAID').length,
    pending: invoices.filter(i => i.status === 'SENT').length,
    overdue: invoices.filter(i => i.status === 'OVERDUE').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Gestion des factures</h1>
        <p className="text-sm text-neutral-600 mt-1">Suivi complet des factures et des paiements</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
          <p className="text-xs text-neutral-500 mt-1">{formatCurrency(stats.totalAmount)}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Payées</p>
          <p className="text-2xl font-bold text-success-600">{stats.paid}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">En attente</p>
          <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">En retard</p>
          <p className="text-2xl font-bold text-danger-600">{stats.overdue}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Taux recouvrement</p>
          <p className="text-2xl font-bold text-primary-600">
            {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%
          </p>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'SENT', 'OVERDUE', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {status === 'ALL' ? 'Toutes' : status === 'SENT' ? 'En attente' : status === 'PAID' ? 'Payées' : 'En retard'}
            </button>
          ))}
        </div>
      </Card>

      {/* Liste */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : invoices.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.DollarSign className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucune facture</h3>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Élève</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Date limite</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Créée le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {invoice.student?.first_name} {invoice.student?.last_name}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invoice.status === 'PAID'
                          ? 'bg-success-100 text-success-700'
                          : invoice.status === 'OVERDUE'
                          ? 'bg-danger-100 text-danger-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}>
                        {invoice.status === 'PAID' ? 'Payée' : invoice.status === 'OVERDUE' ? 'En retard' : 'Envoyée'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
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
