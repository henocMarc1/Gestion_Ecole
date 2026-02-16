'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/helpers';

interface FinanceStats {
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
}

interface Invoice {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
  student?: { first_name: string; last_name: string };
}

export default function FinancesPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FinanceStats>({
    totalInvoices: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFinanceData();
  }, [user]);

  const loadFinanceData = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, student:students(first_name, last_name)')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const invoiceList = data || [];
      const paidCount = invoiceList.filter(i => i.status === 'PAID').length;
      const totalAmount = invoiceList.reduce((sum, i) => sum + (i.amount || 0), 0);
      const paidAmount = invoiceList
        .filter(i => i.status === 'PAID')
        .reduce((sum, i) => sum + (i.amount || 0), 0);

      setStats({
        totalInvoices: invoiceList.length,
        paidInvoices: paidCount,
        unpaidInvoices: invoiceList.length - paidCount,
        totalRevenue: totalAmount,
        pendingAmount: totalAmount - paidAmount,
      });
      setInvoices(invoiceList);
    } catch (error) {
      toast.error('Erreur lors du chargement des finances');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Finances</h1>
        <p className="text-sm text-neutral-600 mt-1">Vue d'ensemble financière de l'école</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Total factures</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.totalInvoices}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Payées</p>
          <p className="text-2xl font-bold text-success-600">{stats.paidInvoices}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Non payées</p>
          <p className="text-2xl font-bold text-danger-600">{stats.unpaidInvoices}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">Total encaissé</p>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(stats.totalRevenue)}</p>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <p className="text-xs text-neutral-600 mb-1">En attente</p>
          <p className="text-2xl font-bold text-warning-600">{formatCurrency(stats.pendingAmount)}</p>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Factures récentes</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center border-t border-neutral-200">
            <Icons.DollarSign className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucune facture</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-t border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Élève</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Date limite</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600">Créée le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                      {invoice.student?.first_name} {invoice.student?.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-neutral-900">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm">
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
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
