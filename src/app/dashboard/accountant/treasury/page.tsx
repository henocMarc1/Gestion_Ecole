'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface Transaction {
  id: string;
  date: string;
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  created_at: string;
}

export default function TreasuryPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'INFLOW',
    category: '',
    description: '',
    amount: '',
    payment_method: 'CASH',
    date: new Date().toISOString().split('T')[0],
  });

  // Catégories prédéfinies
  const expenseCategories = [
    'Salaires personnel',
    'Facture CIE (Électricité)',
    'Facture SODECI (Eau)',
    'Internet/WiFi',
    'Loyer',
    'Fournitures scolaires',
    'Entretien/Maintenance',
    'Transport',
    'Autre dépense',
  ];

  const incomeCategories = [
    'Frais de scolarité',
    'Frais d\'inscription',
    'Paiement cantine',
    'Vente documents',
    'Autre revenu',
  ];

  useEffect(() => {
    if (user?.school_id) {
      loadTransactions();
    }
  }, [user?.school_id]);

  async function loadTransactions() {
    try {
      setIsLoading(true);
      const school_id = user?.school_id;
      if (!school_id) return;

      // Charger les transactions manuelles de trésorerie
      const { data: manualTransactions } = await supabase
        .from('treasury_transactions')
        .select('*')
        .eq('school_id', school_id);

      // Charger les paiements de frais de scolarité (REVENUS/INFLOW)
      const { data: tuitionPayments } = await supabase
        .from('tuition_payments')
        .select('id, amount, payment_date, student_id')
        .eq('school_id', school_id);

      // Charger les factures payées (DÉPENSES/OUTFLOW)
      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('id, amount, created_at, title')
        .eq('school_id', school_id)
        .eq('status', 'PAID');

      // Charger les salaires payés (DÉPENSES/OUTFLOW)
      const { data: paidPayrolls } = await supabase
        .from('payrolls')
        .select('id, net_salary, created_at, employee_name, period')
        .eq('school_id', school_id)
        .eq('status', 'PAID');

      // Convertir en format de transaction
      const convertedTransactions: Transaction[] = [];

      // Ajouter les paiements de frais de scolarité comme INFLOW
      tuitionPayments?.forEach(payment => {
        convertedTransactions.push({
          id: `tuition-${payment.id}`,
          date: payment.payment_date || new Date().toISOString().split('T')[0],
          type: 'INFLOW',
          category: 'Frais de scolarité',
          description: `Paiement scolarité (Élève ${payment.student_id})`,
          amount: payment.amount,
          payment_method: 'VIREMENT',
          created_at: new Date().toISOString(),
        });
      });

      // Ajouter les factures payées comme OUTFLOW
      paidInvoices?.forEach(invoice => {
        convertedTransactions.push({
          id: `invoice-${invoice.id}`,
          date: invoice.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          type: 'OUTFLOW',
          category: 'Factures fournisseurs',
          description: `Facture: ${invoice.title || 'Non spécifiée'}`,
          amount: invoice.amount,
          payment_method: 'CHEQUE',
          created_at: invoice.created_at || new Date().toISOString(),
        });
      });

      // Ajouter les salaires payés comme OUTFLOW
      paidPayrolls?.forEach(payroll => {
        convertedTransactions.push({
          id: `payroll-${payroll.id}`,
          date: payroll.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          type: 'OUTFLOW',
          category: 'Salaires personnel',
          description: `Salaire ${payroll.employee_name} (${payroll.period})`,
          amount: payroll.net_salary,
          payment_method: 'VIREMENT',
          created_at: payroll.created_at || new Date().toISOString(),
        });
      });

      // Ajouter les transactions manuelles
      manualTransactions?.forEach(trans => {
        convertedTransactions.push({
          id: trans.id,
          date: trans.date,
          type: trans.type as 'INFLOW' | 'OUTFLOW',
          category: trans.category,
          description: trans.description,
          amount: trans.amount,
          payment_method: trans.payment_method,
          created_at: trans.created_at,
        });
      });

      // Trier par date décroissante
      const sortedTransactions = convertedTransactions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setTransactions(sortedTransactions);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des transactions');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from('treasury_transactions').insert({
        school_id: user?.school_id,
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        date: formData.date,
      });

      if (error) throw error;
      toast.success('Transaction enregistrée avec succès');
      setIsModalOpen(false);
      setFormData({
        type: 'INFLOW',
        category: '',
        description: '',
        amount: '',
        payment_method: 'CASH',
        date: new Date().toISOString().split('T')[0],
      });
      loadTransactions();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de l'enregistrement de la transaction");
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesDateRange = (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate);
    return matchesSearch && matchesType && matchesDateRange;
  });

  const totalInflow = transactions.filter(t => t.type === 'INFLOW').reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = transactions.filter(t => t.type === 'OUTFLOW').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalInflow - totalOutflow;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Trésorerie</h1>
          <p className="text-sm text-neutral-600">Suivi de trésorerie et flux de caisse</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Icons.Plus className="h-4 w-4 mr-2" />
          Nouvelle transaction
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Icons.TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Entrées</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalInflow)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Icons.TrendingUp className="h-6 w-6 text-red-600 rotate-180" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Sorties</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutflow)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Icons.DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Solde</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg"
          >
            <option value="all">Tous les types</option>
            <option value="INFLOW">Entrées</option>
            <option value="OUTFLOW">Sorties</option>
          </select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Date début"
            className="max-w-xs"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Date fin"
            className="max-w-xs"
          />
        </div>
      </Card>

      {/* Transactions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Mode paiement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    Aucune transaction trouvée
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm text-neutral-900">{formatDate(transaction.date)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'INFLOW' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {transaction.type === 'INFLOW' ? 'Entrée' : 'Sortie'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{transaction.category}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">{transaction.description}</td>
                    <td className={`px-6 py-4 text-sm font-medium ${
                      transaction.type === 'INFLOW' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'INFLOW' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{transaction.payment_method}</td>
                    <td className="px-6 py-4 text-sm">
                      <Button variant="ghost" size="sm">
                        <Icons.Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Nouvelle transaction</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'INFLOW' | 'OUTFLOW' })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  required
                >
                  <option value="INFLOW">Entrée</option>
                  <option value="OUTFLOW">Sortie</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Catégorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {(formData.type === 'OUTFLOW' ? expenseCategories : incomeCategories).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Montant (FCFA)</label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mode de paiement</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  required
                >
                  <option value="CASH">Espèces</option>
                  <option value="BANK_TRANSFER">Virement</option>
                  <option value="CHECK">Chèque</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
