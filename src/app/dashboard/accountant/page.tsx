'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { cn, formatCurrency, formatDate } from '@/utils/helpers';
import { toast, Toaster } from 'sonner';

export default function AccountantDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({
    totalInvoices: 0,
    paidInvoices: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    monthlyRevenue: 0,
    overdueInvoices: 0,
    cashFlowBalance: 0,
    tuitionRevenue: 0,
    salaryExpenses: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.school_id) {
      loadStats();
      loadRecentTransactions();
    }
  }, [user?.school_id]);

  const loadRecentTransactions = async () => {
    try {
      const school_id = user?.school_id;
      if (!school_id) return;

      const { data } = await supabase
        .from('treasury_transactions')
        .select('*')
        .eq('school_id', school_id)
        .order('date', { ascending: false })
        .limit(5);

      setRecentTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const school_id = user?.school_id;
      if (!school_id) return;

      // Récupérer les factures (DÉPENSES)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('school_id', school_id);

      // Récupérer les paiements généraux (pas utilisé pour revenus)
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'COMPLETED')
        .eq('school_id', school_id);

      // Paiements de frais de scolarité (REVENUS)
      const { data: tuitionPayments } = await supabase
        .from('tuition_payments')
        .select('*')
        .eq('school_id', school_id);

      // Salaires payés (DÉPENSES)
      const { data: payrolls } = await supabase
        .from('payrolls')
        .select('*')
        .eq('school_id', school_id)
        .eq('status', 'PAID');

      // Revenus du mois en cours (SEULEMENT frais de scolarité)
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyTuitionPayments = tuitionPayments?.filter(p => p.payment_date?.startsWith(currentMonth)) || [];
      
      const monthlyRevenue = monthlyTuitionPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Trésorerie
      const { data: treasury } = await supabase
        .from('treasury_transactions')
        .select('*')
        .eq('school_id', school_id);

      const cashFlow = treasury?.reduce((sum, t) => {
        return t.type === 'INFLOW' ? sum + t.amount : sum - t.amount;
      }, 0) || 0;

      // REVENUS TOTAUX = SEULEMENT frais de scolarité + paiements
      const generalpaymentRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const tuitionRevenue = tuitionPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const totalRevenue = generalpaymentRevenue + tuitionRevenue;

      // DÉPENSES TOTALES = factures + salaires
      const invoiceExpenses = invoices?.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
      const salaryExpenses = payrolls?.reduce((sum, p) => sum + (p.net_salary || 0), 0) || 0;
      const totalExpenses = invoiceExpenses + salaryExpenses;

      const paidCount = invoices?.filter((i) => i.status === 'PAID').length || 0;
      const pendingCount = invoices?.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE').length || 0;
      const overdueCount = invoices?.filter((i) => i.status === 'OVERDUE').length || 0;

      setStats({
        totalInvoices: invoices?.length || 0,
        paidInvoices: paidCount,
        totalRevenue,
        pendingPayments: pendingCount,
        monthlyRevenue,
        overdueInvoices: overdueCount,
        cashFlowBalance: cashFlow,
        tuitionRevenue,
        salaryExpenses,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-emerald-50">
        <div className="relative overflow-hidden pb-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_40%)]" />
          <header className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Finance</span>
              <h1 className="text-3xl font-semibold text-neutral-900">Gestion financière</h1>
              <p className="text-sm text-neutral-600 max-w-2xl">Flux de facturation, paiements et relances en un clin d'œil.</p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.FileText className="w-3.5 h-3.5 text-neutral-700" /> {stats.totalInvoices} factures
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Check className="w-3.5 h-3.5 text-emerald-600" /> {stats.paidInvoices} payées
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => loadStats()}>
                <Icons.Activity className="w-4 h-4 mr-2" /> Rafraîchir
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  signOut();
                  router.push('/login');
                }}
              >
                Déconnexion
              </Button>
            </div>
          </header>
        </div>

        {/* Main Content */}
        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Total factures', value: stats.totalInvoices, icon: Icons.FileText, accent: 'bg-neutral-900' },
                { label: 'Factures payées', value: stats.paidInvoices, icon: Icons.Check, accent: 'bg-emerald-600' },
                { label: 'Revenus totaux', value: formatCurrency(stats.totalRevenue), icon: Icons.DollarSign, accent: 'bg-blue-600' },
                { label: 'En attente', value: stats.pendingPayments, icon: Icons.Calendar, accent: 'bg-amber-600' },
              ].map((item) => (
                <Card
                  key={item.label}
                  className="p-6 border border-neutral-200 shadow-sm bg-white/90 backdrop-blur"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-600">{item.label}</p>
                      <p className="text-2xl font-semibold text-neutral-900">{isLoading ? '…' : item.value}</p>
                    </div>
                    <div className="h-11 w-11 rounded-lg text-white flex items-center justify-center shadow-sm" style={{ backgroundColor: 'transparent' }}>
                      <div className={`${item.accent} w-full h-full rounded-lg flex items-center justify-center`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* KPIs mensuels et alertes */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Icons.TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-600">Revenus ce mois</p>
                    <p className="text-xl font-bold text-neutral-900">{formatCurrency(stats.monthlyRevenue)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Icons.Student className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-600">Frais scolarité</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.tuitionRevenue)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Icons.Users className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-600">Salaires payés</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.salaryExpenses)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Icons.AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-600">Factures en retard</p>
                    <p className="text-xl font-bold text-red-600">{stats.overdueInvoices}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Icons.DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-600">Solde trésorerie</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(stats.cashFlowBalance)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Transactions récentes */}
            <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Transactions récentes</h2>
                  <p className="text-sm text-neutral-600">Dernières opérations de trésorerie</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/accountant/treasury')}>
                  <Icons.Eye className="h-4 w-4 mr-2" /> Voir tout
                </Button>
              </div>
              {recentTransactions.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">Aucune transaction récente</p>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${t.type === 'INFLOW' ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
                          {t.type === 'INFLOW' ? (
                            <Icons.ChevronDown className="h-5 w-5 text-green-600" />
                          ) : (
                            <Icons.TrendingUp className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{t.description || t.category}</p>
                          <p className="text-sm text-neutral-600">{formatDate(t.date)} • {t.payment_method}</p>
                        </div>
                      </div>
                      <p className={`font-semibold ${t.type === 'INFLOW' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'INFLOW' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card className="p-8 border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Actions rapides</h2>
                  <p className="text-sm text-neutral-600">Accès direct aux opérations comptables.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[{
                  title: 'Voir les factures',
                  description: 'Filtrer et exporter',
                  icon: Icons.FileText,
                  href: '/dashboard/accountant/invoices',
                }, {
                  title: 'Enregistrer un paiement',
                  description: 'Paiements entrants',
                  icon: Icons.DollarSign,
                  href: '/dashboard/accountant/payments',
                }, {
                  title: 'Voir les paiements',
                  description: 'Historique et reçus',
                  icon: Icons.Check,
                  href: '/dashboard/accountant/payments',
                }, {
                  title: 'Rappels de paiement',
                  description: 'Relances automatiques',
                  icon: Icons.Bell,
                  href: '/dashboard/accountant/payment-reminders',
                }].map((action) => (
                  <Card
                    key={action.title}
                    className="border border-neutral-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => router.push(action.href)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="p-5 flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-900">{action.title}</h3>
                        <p className="text-sm text-neutral-600">{action.description}</p>
                      </div>
                      <Icons.ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600" />
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            {/* Welcome Message */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="p-8 bg-neutral-900 text-white border border-neutral-800 shadow-md lg:col-span-2">
                <h2 className="text-2xl font-semibold mb-2">
                  Bienvenue {user?.full_name}
                </h2>
                <p className="text-neutral-200 mb-4">
                  Vous êtes connecté en tant que Comptable. Gardez une visibilité claire sur la trésorerie et les relances.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Icons.Check className="w-4 h-4 text-emerald-300 mt-0.5" />
                    <span>Valider les paiements reçus</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Icons.AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5" />
                    <span>Relancer les factures en attente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Icons.Mail className="w-4 h-4 text-blue-200 mt-0.5" />
                    <span>Partager les reçus aux parents</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Notes rapides</h3>
                <ul className="space-y-2 text-sm text-neutral-700">
                  <li className="flex items-start gap-2">
                    <Icons.Dot className="w-4 h-4 text-neutral-400" />
                    <span>Vérifier les factures en retard et planifier les relances.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.Dot className="w-4 h-4 text-neutral-400" />
                    <span>Exporter le rapport hebdomadaire des encaissements.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.Dot className="w-4 h-4 text-neutral-400" />
                    <span>Synchroniser les reçus avec le secrétariat.</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
