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
import { exportToExcel, exportToPDFTable } from '@/utils/exportUtils';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: 'FIXED' | 'VARIABLE';
  supplier_name: string;
  payment_status: 'PAID' | 'PENDING' | 'OVERDUE';
  proof_document_url: string | null;
  created_at: string;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{ name?: string; address?: string; phone?: string } | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    type: 'VARIABLE',
    supplier_name: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadExpenses();
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

  async function loadExpenses() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('school_id', user?.school_id)
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des charges');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsUploading(true);
      let proofUrl = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user?.school_id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expense-proofs')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('expense-proofs')
          .getPublicUrl(fileName);

        proofUrl = publicUrl;
      }

      const { error } = await supabase.from('expenses').insert({
        school_id: user?.school_id,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        supplier_name: formData.supplier_name,
        date: formData.date,
        payment_status: 'PENDING',
        proof_document_url: proofUrl,
      });

      if (error) throw error;
      toast.success('Charge créée avec succès');
      setIsModalOpen(false);
      setFormData({
        category: '',
        description: '',
        amount: '',
        type: 'VARIABLE',
        supplier_name: '',
        date: new Date().toISOString().split('T')[0],
      });
      setSelectedFile(null);
      loadExpenses();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la création de la charge');
    } finally {
      setIsUploading(false);
    }
  }

  const handleExportExpenses = async () => {
    try {
      const headers = ['Date', 'Description', 'Catégorie', 'Montant', 'Type', 'Fournisseur', 'Statut'];
      const rows = filteredExpenses.map(e => [
        new Date(e.date).toLocaleDateString('fr-FR'),
        e.description,
        e.category,
        formatCurrency(e.amount),
        e.type === 'FIXED' ? 'Fixe' : 'Variable',
        e.supplier_name || '-',
        e.payment_status,
      ]);

      await exportToPDFTable(
        'Rapport des Charges',
        headers,
        rows,
        `charges_${new Date().toISOString().split('T')[0]}`,
        {
          schoolName: schoolInfo?.name || 'Établissement',
          schoolAddress: schoolInfo?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
          schoolPhone: schoolInfo?.phone || '+225 0707905958',
        }
      );
      toast.success('Rapport des charges exporté en PDF');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    }
  };

  const handleExportExpensesCSV = async () => {
    try {
      const data = filteredExpenses.map(e => ({
        'Date': new Date(e.date).toLocaleDateString('fr-FR'),
        'Description': e.description,
        'Catégorie': e.category,
        'Montant': e.amount,
        'Type': e.type,
        'Fournisseur': e.supplier_name || '-',
        'Statut': e.payment_status,
      }));

      await exportToExcel(data, `charges_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Fichier Excel téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    }
  }

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || e.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || e.payment_status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const fixedExpenses = expenses.filter(e => e.type === 'FIXED').reduce((sum, e) => sum + e.amount, 0);
  const variableExpenses = expenses.filter(e => e.type === 'VARIABLE').reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = fixedExpenses + variableExpenses;
  const pendingCount = expenses.filter(e => e.payment_status === 'PENDING' || e.payment_status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Charges</h1>
          <p className="text-sm text-neutral-600">Suivi des charges fixes et variables</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportExpenses}>
            <Icons.Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleExportExpensesCSV}>
            <Icons.Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Icons.Plus className="h-4 w-4 mr-2" />
            Nouvelle charge
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Icons.CreditCard className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total charges</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalExpenses)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Icons.Activity className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Charges fixes</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(fixedExpenses)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Icons.TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Charges variables</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(variableExpenses)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Icons.AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">En attente</p>
              <p className="text-2xl font-bold text-neutral-900">{pendingCount}</p>
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
            <option value="FIXED">Charges fixes</option>
            <option value="VARIABLE">Charges variables</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg"
          >
            <option value="all">Tous les statuts</option>
            <option value="PAID">Payée</option>
            <option value="PENDING">En attente</option>
            <option value="OVERDUE">En retard</option>
          </select>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Fournisseur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">
                    Aucune charge trouvée
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm text-neutral-900">{formatDate(expense.date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{expense.category}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{expense.description}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{expense.supplier_name || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        expense.type === 'FIXED' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {expense.type === 'FIXED' ? 'Fixe' : 'Variable'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        expense.payment_status === 'PAID' ? 'bg-green-100 text-green-700' :
                        expense.payment_status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {expense.payment_status === 'PAID' ? 'Payée' :
                         expense.payment_status === 'PENDING' ? 'En attente' : 'En retard'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Icons.Eye className="h-4 w-4" />
                        </Button>
                        {expense.proof_document_url && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(expense.proof_document_url!, '_blank')}
                          >
                            <Icons.FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
            <h2 className="text-xl font-bold mb-4">Nouvelle charge</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Catégorie</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Loyer, Salaires, Fournitures..."
                  required
                />
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
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'FIXED' | 'VARIABLE' })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  required
                >
                  <option value="FIXED">Charge fixe</option>
                  <option value="VARIABLE">Charge variable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fournisseur</label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="Optionnel"
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
                <label className="block text-sm font-medium mb-2">Justificatif (Photo/PDF)</label>
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <Icons.Check className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-neutral-900">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Icons.FileText className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                        <p className="text-sm text-neutral-600">Cliquez pour ajouter une preuve</p>
                        <p className="text-xs text-neutral-500 mt-1">Photo ou PDF (optionnel)</p>
                      </div>
                    )}
                  </label>
                </div>
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
                  Créer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
