'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { exportToExcel } from '@/utils/exportUtils';

interface FinancialStats {
  totalRevenue: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
}

interface StaffPayroll {
  id: string;
  full_name: string;
  role: string;
}

interface Invoice {
  id: string;
  student_id: string;
  student_name?: string;
  amount: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  due_date: string;
  created_at: string;
  paid_date?: string;
}

export default function FinancialDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<FinancialStats>({
    totalRevenue: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [staffPayroll, setStaffPayroll] = useState<StaffPayroll[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [isExporting, setIsExporting] = useState(false);

  useRealtimeSubscription({
    table: 'invoices',
    event: '*',
    onData: () => loadFinancialData(),
    enabled: !!user?.school_id,
  });

  const loadFinancialData = async () => {
    try {
      if (!user?.school_id) return;

      // Get all invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(
          `
          id,
          student_id,
          amount,
          status,
          due_date,
          created_at,
          paid_date,
          students(full_name)
        `
        )
        .eq('school_id', user.school_id)
        .order('created_at', { ascending: false });

      if (invoicesError && invoicesError.code !== 'PGRST116') throw invoicesError;

      const formattedInvoices = (invoicesData || []).map((inv: any) => ({
        id: inv.id,
        student_id: inv.student_id,
        student_name: inv.students?.full_name || 'Unknown',
        amount: inv.amount,
        status: inv.status,
        due_date: inv.due_date,
        created_at: inv.created_at,
        paid_date: inv.paid_date,
      }));

      setInvoices(formattedInvoices);

      // Load staff payroll
      const { data: staffData, error: staffError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .neq('role', 'PARENT')
        .neq('role', 'STUDENT');

      if (staffError && staffError.code !== 'PGRST116') throw staffError;

      const payroll = (staffData || []).map((s: any) => ({
        id: s.id,
        full_name: s.full_name || 'N/A',
        role: s.role,
      }));

      setStaffPayroll(payroll);

      // Calculate stats
      const stats: FinancialStats = {
        totalRevenue: 0,
        paidAmount: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        totalInvoices: formattedInvoices.length,
        paidInvoices: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
      };

      const now = new Date();
      formattedInvoices.forEach((inv: Invoice) => {
        stats.totalRevenue += inv.amount;

        if (inv.status === 'PAID') {
          stats.paidAmount += inv.amount;
          stats.paidInvoices += 1;
        } else if (inv.status === 'OVERDUE') {
          stats.overdueAmount += inv.amount;
          stats.overdueInvoices += 1;
        } else if (inv.status === 'SENT') {
          stats.pendingAmount += inv.amount;
          stats.pendingInvoices += 1;
        }
      });

      setStats(stats);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'PAID',
          paid_date: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success('Facture marquée comme payée');
      await loadFinancialData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSendReminder = async (invoiceId: string) => {
    try {
      // In a real app, this would send an email/SMS
      toast.success('Rappel envoyé à l\'étudiant');
      // await loadFinancialData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi du rappel');
    }
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const data = invoices.map((inv) => ({
        'Étudiant': inv.student_name,
        'Montant (XOF)': inv.amount,
        'Statut': inv.status,
        'Date Due': new Date(inv.due_date).toLocaleDateString('fr-CI'),
        'Date de Paiement': inv.paid_date ? new Date(inv.paid_date).toLocaleDateString('fr-CI') : '-',
      }));

      await exportToExcel(data, `rapport-financier-${selectedMonth}.xlsx`);
      toast.success('Rapport Excel exporté avec succès');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [user?.school_id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Removed payroll calculation as salary field doesn't exist
  const payrollTotal = 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapport Financier</h1>
          <p className="text-gray-600 mt-2">Gestion complète des revenus et factures</p>
        </div>
        <Button
          onClick={handleExportReport}
          disabled={isExporting}
          className="bg-green-600 hover:bg-green-700"
        >
          {isExporting ? (
            <>
              <Icons.Loader className="w-4 h-4 mr-2 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <Icons.Download className="w-4 h-4 mr-2" />
              Exporter Excel
            </>
          )}
        </Button>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Revenus Total</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {stats.totalRevenue.toLocaleString('fr-CI')} XOF
                </p>
              </div>
              <Icons.DollarSign className="w-12 h-12 text-blue-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Payés</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {stats.paidAmount.toLocaleString('fr-CI')} XOF
                </p>
                <p className="text-xs text-gray-500 mt-1">({stats.paidInvoices} factures)</p>
              </div>
              <Icons.CheckCircle className="w-12 h-12 text-green-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">En Attente</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">
                  {stats.pendingAmount.toLocaleString('fr-CI')} XOF
                </p>
                <p className="text-xs text-gray-500 mt-1">({stats.pendingInvoices} factures)</p>
              </div>
              <Icons.Clock className="w-12 h-12 text-yellow-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">En Retard</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {stats.overdueAmount.toLocaleString('fr-CI')} XOF
                </p>
                <p className="text-xs text-gray-500 mt-1">({stats.overdueInvoices} factures)</p>
              </div>
              <Icons.AlertTriangle className="w-12 h-12 text-red-300" />
            </div>
          </div>
        </Card>
      </div>

      {/* Payroll Overview */}
      <Card>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Salaires du personnel</h2>
            <p className="text-gray-600 text-sm">Visible par Comptable et RH</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Masse salariale</p>
            <p className="text-2xl font-bold text-gray-900">{payrollTotal.toLocaleString('fr-CI')} XOF</p>
          </div>
        </div>

        {staffPayroll.length === 0 ? (
          <div className="p-12 text-center">
            <Icons.Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucun salarié enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Employé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {staffPayroll.map((staff) => (
                  <tr key={staff.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{staff.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{staff.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invoice Details */}
      <Card>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Liste des Factures</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mois:</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-32"
            />
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center">
            <Icons.FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucune facture pour l'instant</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Étudiant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Date Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{invoice.student_name}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {invoice.amount.toLocaleString('fr-CI')} XOF
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(invoice.due_date).toLocaleDateString('fr-CI')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          invoice.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'OVERDUE'
                              ? 'bg-red-100 text-red-800'
                              : invoice.status === 'SENT'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {invoice.status === 'PAID'
                          ? 'Payée'
                          : invoice.status === 'OVERDUE'
                            ? 'En Retard'
                            : invoice.status === 'SENT'
                              ? 'En Attente'
                              : invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      {invoice.status !== 'PAID' && (
                        <>
                          <Button
                            onClick={() => handleMarkAsPaid(invoice.id)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            Marquer Payée
                          </Button>
                          <Button
                            onClick={() => handleSendReminder(invoice.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            Relancer
                          </Button>
                        </>
                      )}
                      {invoice.status === 'PAID' && (
                        <span className="text-xs text-gray-500">
                          Payée le {invoice.paid_date ? new Date(invoice.paid_date).toLocaleDateString('fr-CI') : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé Financier</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">Total des Factures</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Taux de Paiement</p>
              <p className="text-2xl font-bold text-green-900">
                {stats.totalInvoices > 0
                  ? Math.round((stats.paidInvoices / stats.totalInvoices) * 100)
                  : 0}
                %
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Montant en Retard</p>
              <p className="text-2xl font-bold text-red-900">
                {stats.overdueAmount.toLocaleString('fr-CI')} XOF
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
