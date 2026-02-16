'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/helpers';
import { exportToExcel, exportToPDFTable } from '@/utils/exportUtils';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

interface ReportStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalStudents: number;
  paidInvoices: number;
  unpaidInvoices: number;
  payrollTotal: number;
  generalPaymentCount: number;
  tuitionPaymentCount: number;
  generalPaymentAmount: number;
  tuitionPaymentAmount: number;
}

interface ChartItem {
  label: string;
  value: number;
  colorHex: string;
}

interface MonthlyPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export default function AccountantReportsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    totalStudents: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    payrollTotal: 0,
    generalPaymentCount: 0,
    tuitionPaymentCount: 0,
    generalPaymentAmount: 0,
    tuitionPaymentAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [monthlySeries, setMonthlySeries] = useState<MonthlyPoint[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<{ name?: string; address?: string; phone?: string } | null>(null);

  const expenseOther = Math.max(stats.totalExpenses - stats.payrollTotal, 0);

  const revenueBreakdown: ChartItem[] = [
    { label: 'Paiements generaux', value: stats.generalPaymentAmount, colorHex: '#10b981' },
    { label: 'Frais scolarite', value: stats.tuitionPaymentAmount, colorHex: '#14b8a6' },
  ];

  const expenseBreakdown: ChartItem[] = [
    { label: 'Salaires', value: stats.payrollTotal, colorHex: '#f43f5e' },
    { label: 'Autres charges', value: expenseOther, colorHex: '#f97316' },
  ];

  const paymentCounts: ChartItem[] = [
    { label: 'Paiements generaux', value: stats.generalPaymentCount, colorHex: '#0ea5e9' },
    { label: 'Paiements frais', value: stats.tuitionPaymentCount, colorHex: '#6366f1' },
  ];

  const pieRevenueData = revenueBreakdown.map((item) => ({
    name: item.label,
    value: item.value,
    color: item.colorHex,
  }));

  const pieExpenseData = expenseBreakdown.map((item) => ({
    name: item.label,
    value: item.value,
    color: item.colorHex,
  }));

  const piePaymentData = paymentCounts.map((item) => ({
    name: item.label,
    value: item.value,
    color: item.colorHex,
  }));

  const monthsCount = 12;

  function getRecentMonths(basePeriod: string, count: number) {
    const [yearStr, monthStr] = basePeriod.split('-');
    const baseYear = Number(yearStr);
    const baseMonthIndex = Number(monthStr) - 1;
    const months = [] as { key: string; label: string }[];

    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(baseYear, baseMonthIndex - offset, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push({
        key: `${year}-${month}`,
        label: `${month}/${String(year).slice(-2)}`,
      });
    }

    return months;
  }

  useEffect(() => {
    loadReportData();
  }, [user, selectedPeriod]);

  useEffect(() => {
    loadSchoolInfo();
  }, [user?.school_id]);

  async function loadSchoolInfo() {
    if (!user?.school_id) return;
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('name, address, phone')
        .eq('id', user.school_id)
        .single();

      if (error) throw error;
      setSchoolInfo(data || null);
    } catch (error) {
      console.error('Erreur chargement école:', error);
    }
  }

  async function loadReportData() {
    try {
      if (!user?.school_id) return;
      setIsLoading(true);

      // Charger les factures (DÉPENSES) - filtrées par mois sélectionné
      const { data: invoices } = await supabase
        .from('invoices')
        .select('amount, status')
        .eq('school_id', user.school_id)
        .gte('created_at', `${selectedPeriod}-01`)
        .lt('created_at', `${selectedPeriod}-31`);

      const paidInvoiceCount = (invoices || []).filter(i => i.status === 'PAID').length;
      const unpaidInvoiceCount = (invoices || []).filter(i => i.status !== 'PAID').length;

      // Sorties de trésorerie (OUTFLOW) - toutes périodes (doit matcher la carte Trésorerie)
      const { data: treasuryOutflowsAll } = await supabase
        .from('treasury_transactions')
        .select('amount')
        .eq('school_id', user.school_id)
        .eq('type', 'OUTFLOW');

      const treasuryOutflowTotal = (treasuryOutflowsAll || []).reduce(
        (sum, flow) => sum + (Number(flow.amount) || 0),
        0
      );

      // Factures payées (toutes périodes)
      const { data: paidInvoicesAll } = await supabase
        .from('invoices')
        .select('amount')
        .eq('school_id', user.school_id)
        .eq('status', 'PAID');

      const invoiceExpensesAll = (paidInvoicesAll || []).reduce(
        (sum, invoice) => sum + (Number(invoice.amount) || 0),
        0
      );

      // Salaires payés (toutes périodes)
      const { data: paidPayrollsAll } = await supabase
        .from('payrolls')
        .select('net_salary')
        .eq('school_id', user.school_id)
        .eq('status', 'PAID');

      const payrollTotalAll = (paidPayrollsAll || []).reduce(
        (sum, payroll) => sum + (Number(payroll.net_salary) || 0),
        0
      );

      // Charger TOUS les paiements généraux (pas filtrés par mois) - REVENUS
      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('school_id', user.school_id);

      const generalPaymentRevenue = (allPayments || []).reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      ) || 0;
      const generalPaymentCount = (allPayments || []).length;

      // Charger TOUS les paiements de frais de scolarité (pas filtrés par mois) - REVENUS
      const { data: allTuitionPayments } = await supabase
        .from('tuition_payments')
        .select('amount')
        .eq('school_id', user.school_id);

      const tuitionRevenue = (allTuitionPayments || []).reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      ) || 0;
      const tuitionPaymentCount = (allTuitionPayments || []).length;

      // TOTAL REVENUS = Paiements généraux + Frais de scolarité (PAS les factures)
      const totalRevenue = generalPaymentRevenue + tuitionRevenue;

      // TOTAL DÉPENSES = Sorties de trésorerie + factures payées + salaires payés
      const totalExpenses = treasuryOutflowTotal + invoiceExpensesAll + payrollTotalAll;

      // Charger le nombre d'élèves
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', user.school_id)
        .is('deleted_at', null);

      setStats({
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        totalStudents: studentCount || 0,
        paidInvoices: paidInvoiceCount,
        unpaidInvoices: unpaidInvoiceCount,
        payrollTotal: payrollTotalAll,
        generalPaymentCount,
        tuitionPaymentCount,
        generalPaymentAmount: generalPaymentRevenue,
        tuitionPaymentAmount: tuitionRevenue,
      });

      const recentMonths = getRecentMonths(selectedPeriod, monthsCount);
      const rangeStart = `${recentMonths[0].key}-01`;
      const lastMonth = recentMonths[recentMonths.length - 1].key;
      const [lastYearStr, lastMonthStr] = lastMonth.split('-');
      const endDate = new Date(Number(lastYearStr), Number(lastMonthStr), 1);
      const rangeEnd = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: paymentsRange } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('school_id', user.school_id)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd);

      const { data: tuitionPaymentsRange } = await supabase
        .from('tuition_payments')
        .select('amount, created_at')
        .eq('school_id', user.school_id)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd);

      const { data: invoicesRange } = await supabase
        .from('invoices')
        .select('amount, status, created_at')
        .eq('school_id', user.school_id)
        .eq('status', 'PAID')
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd);

      const { data: payrollsRange } = await supabase
        .from('payrolls')
        .select('net_salary, status, created_at')
        .eq('school_id', user.school_id)
        .eq('status', 'PAID')
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd);

      const { data: treasuryOutflowsRange } = await supabase
        .from('treasury_transactions')
        .select('amount, type, date')
        .eq('school_id', user.school_id)
        .eq('type', 'OUTFLOW')
        .gte('date', rangeStart)
        .lt('date', rangeEnd);

      const monthlyMap = new Map(
        recentMonths.map((month) => [
          month.key,
          { month: month.label, revenue: 0, expenses: 0 },
        ])
      );

      (paymentsRange || []).forEach((payment) => {
        const key = String(payment.created_at).slice(0, 7);
        const entry = monthlyMap.get(key);
        if (entry) {
          entry.revenue += Number(payment.amount) || 0;
        }
      });

      (tuitionPaymentsRange || []).forEach((payment) => {
        const key = String(payment.created_at).slice(0, 7);
        const entry = monthlyMap.get(key);
        if (entry) {
          entry.revenue += Number(payment.amount) || 0;
        }
      });

      (invoicesRange || []).forEach((invoice) => {
        const key = String(invoice.created_at).slice(0, 7);
        const entry = monthlyMap.get(key);
        if (entry) {
          entry.expenses += Number(invoice.amount) || 0;
        }
      });

      (payrollsRange || []).forEach((payroll) => {
        const key = String(payroll.created_at).slice(0, 7);
        const entry = monthlyMap.get(key);
        if (entry) {
          entry.expenses += Number(payroll.net_salary) || 0;
        }
      });

      (treasuryOutflowsRange || []).forEach((flow) => {
        const key = String(flow.date).slice(0, 7);
        const entry = monthlyMap.get(key);
        if (entry) {
          entry.expenses += Number(flow.amount) || 0;
        }
      });

      setMonthlySeries(Array.from(monthlyMap.values()));
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des rapports');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExportPDF() {
    try {
      const headers = ['Métrique', 'Valeur'];
      const rows = [
        ['Total revenus', formatCurrency(stats.totalRevenue)],
        ['Total dépenses', formatCurrency(stats.totalExpenses)],
        ['Revenu net', formatCurrency(stats.netIncome)],
        ['Total élèves', stats.totalStudents.toString()],
        ['Factures payées', stats.paidInvoices.toString()],
        ['Factures impayées', stats.unpaidInvoices.toString()],
        ['Total salaires', formatCurrency(stats.payrollTotal)],
      ];

      await exportToPDFTable(
        `Rapport Financier - ${selectedPeriod}`,
        headers,
        rows,
        `rapport_financier_${selectedPeriod}`,
        {
          schoolName: schoolInfo?.name || 'Établissement',
          schoolAddress: schoolInfo?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
          schoolPhone: schoolInfo?.phone || '+225 0707905958',
        }
      );
      toast.success('Rapport PDF téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export PDF');
      console.error(error);
    }
  }

  async function handleExportCSV() {
    try {
      const data = [
        { Métrique: 'Total revenus', Valeur: stats.totalRevenue },
        { Métrique: 'Total dépenses', Valeur: stats.totalExpenses },
        { Métrique: 'Revenu net', Valeur: stats.netIncome },
        { Métrique: 'Total élèves', Valeur: stats.totalStudents },
        { Métrique: 'Factures payées', Valeur: stats.paidInvoices },
        { Métrique: 'Factures impayées', Valeur: stats.unpaidInvoices },
        { Métrique: 'Total salaires', Valeur: stats.payrollTotal },
      ];

      await exportToExcel(data, `rapport_financier_${selectedPeriod}.xlsx`);
      toast.success('Rapport Excel téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
      console.error(error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Rapports Financiers</h1>
          <p className="text-sm text-neutral-600">Consultez les rapports financiers de l'école</p>
        </div>
        <div className="flex gap-3">
          <input
            type="month"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg"
          />
          <Button variant="outline" onClick={handleExportPDF}>
            <Icons.Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Icons.Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Icons.TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total revenus</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Icons.CreditCard className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total dépenses</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(stats.totalExpenses)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
              stats.netIncome >= 0 ? 'bg-blue-100' : 'bg-orange-100'
            }`}>
              <Icons.DollarSign className={`h-6 w-6 ${
                stats.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Revenu net</p>
              <p className={`text-2xl font-bold ${
                stats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(stats.netIncome)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Icons.Student className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total élèves</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.totalStudents}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Détails */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Revenus détaillés</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Paiements généraux</span>
              <span className="text-sm font-medium text-neutral-900">
                {formatCurrency(stats.generalPaymentAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Frais scolaires payés</span>
              <span className="text-sm font-medium text-neutral-900">
                {formatCurrency(stats.tuitionPaymentAmount)}
              </span>
            </div>
            <div className="h-px bg-neutral-200" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-neutral-900">Total collecté</span>
              <span className="text-sm font-bold text-green-600">
                {formatCurrency(stats.totalRevenue)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Dépenses détaillées</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Salaires</span>
              <span className="text-sm font-medium text-neutral-900">
                {formatCurrency(stats.payrollTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-600">Autres charges</span>
              <span className="text-sm font-medium text-neutral-900">
                {formatCurrency(expenseOther)}
              </span>
            </div>
            <div className="h-px bg-neutral-200" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-neutral-900">Total dépensé</span>
              <span className="text-sm font-bold text-red-600">
                {formatCurrency(stats.totalExpenses)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Revenus par source</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieRevenueData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {pieRevenueData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Dépenses par type</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieExpenseData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {pieExpenseData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Volume des paiements</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={piePaymentData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {piePaymentData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => Number(value)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Tendance mensuelle</h3>
            <p className="text-xs text-neutral-500">Revenus et dépenses sur {monthsCount} mois</p>
          </div>
          <div className="text-xs text-neutral-500">
            Derniere periode: {selectedPeriod}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlySeries} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenus"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Dépenses"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
