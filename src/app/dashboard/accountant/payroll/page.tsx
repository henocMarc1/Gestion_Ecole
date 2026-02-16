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

interface Payroll {
  id: string;
  employee_id: string;
  employee_name: string;
  period: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  cnps: number;
  irpp: number;
  net_salary: number;
  status: 'DRAFT' | 'PROCESSED' | 'PAID';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

export default function PayrollPage() {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [selectedPayrolls, setSelectedPayrolls] = useState<string[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{ name?: string; address?: string; phone?: string } | null>(null);

  useEffect(() => {
    if (user?.school_id) {
      loadPayrolls();
    }
  }, [selectedPeriod, user?.school_id]);

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

  async function loadPayrolls() {
    if (!user?.school_id) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payrolls')
        .select('*, employee:users!employee_id(full_name)')
        .eq('school_id', user.school_id)
        .eq('period', selectedPeriod)
        .order('employee_name');

      if (error) throw error;
      
      // Transform data to include employee_name
      const transformed = data?.map(p => ({
        ...p,
        employee_name: p.employee?.full_name || 'Inconnu'
      })) || [];
      
      setPayrolls(transformed);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des salaires');
    } finally {
      setIsLoading(false);
    }
  }

  async function generatePayroll() {
    if (!user?.school_id || isGenerating) return;
    
    setIsGenerating(true);
    try {
      // Get all employees (TEACHER and other staff) with their salary
      const { data: employees, error } = await supabase
        .from('users')
        .select('id, full_name, salary')
        .eq('school_id', user.school_id)
        .in('role', ['TEACHER', 'SECRETARY', 'HR', 'ACCOUNTANT']);

      if (error) throw error;

      if (!employees || employees.length === 0) {
        toast.error('Aucun employé trouvé');
        return;
      }

      // Vérifier si des fiches existent déjà pour cette période et cette école
      const { data: existing } = await supabase
        .from('payrolls')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('period', selectedPeriod);

      if (existing && existing.length > 0) {
        toast.error('Des fiches de paie existent déjà pour cette période. Supprimez-les d\'abord ou modifiez la période.');
        await loadPayrolls();
        return;
      }

      // Create payroll entries with employee salary from users table
      const payrollEntries = employees.map(emp => {
        const baseSalary = emp.salary || 0;
        return {
          school_id: user.school_id,
          employee_id: emp.id,
          employee_name: emp.full_name,
          period: selectedPeriod,
          base_salary: baseSalary,
          bonuses: 0,
          deductions: 0,
          net_salary: baseSalary,
          status: 'DRAFT',
        };
      });

      const { error: insertError } = await supabase
        .from('payrolls')
        .insert(payrollEntries);

      if (insertError) {
        // Gérer spécifiquement l'erreur de duplication
        if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
          toast.error('Des fiches de paie existent déjà pour cette période');
          await loadPayrolls();
          return;
        }
        throw insertError;
      }
      
      toast.success(`${payrollEntries.length} fiches de paie générées`);
      await loadPayrolls();
    } catch (error: any) {
      console.error('Erreur:', error);
      if (error?.code !== '23505') {
        toast.error('Erreur lors de la génération des salaires');
      }
    } finally {
      setIsGenerating(false);
    }
  }

  const handleExportPayroll = async () => {
    try {
      const headers = ['Employé', 'Salaire de base', 'Primes', 'Déductions', 'Salaire net', 'Statut'];
      const rows = filteredPayrolls.map(p => [
        p.employee_name,
        formatCurrency(p.base_salary),
        formatCurrency(p.bonuses),
        formatCurrency(p.deductions),
        formatCurrency(p.net_salary),
        p.status,
      ]);

      await exportToPDFTable(
        `Fiche de Paie - ${selectedPeriod}`,
        headers,
        rows,
        `paie_${selectedPeriod}`,
        {
          schoolName: schoolInfo?.name || 'Établissement',
          schoolAddress: schoolInfo?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
          schoolPhone: schoolInfo?.phone || '+225 0707905958',
        }
      );
      toast.success('Fiche de paie exportée en PDF');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const data = filteredPayrolls.map(p => ({
        'Employé': p.employee_name,
        'Salaire de base': p.base_salary,
        'Primes': p.bonuses,
        'Déductions': p.deductions,
        'Salaire net': p.net_salary,
        'Statut': p.status,
      }));

      await exportToExcel(data, `paie_${selectedPeriod}.xlsx`);
      toast.success('Fichier Excel téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    }
  }

  const handleExportPayrollPDF = async (payroll: Payroll) => {
    try {
      const headers = ['Champ', 'Valeur'];
      const rows = [
        ['Employé', payroll.employee_name],
        ['Période', payroll.period],
        ['Salaire de base', formatCurrency(payroll.base_salary)],
        ['Primes', formatCurrency(payroll.bonuses)],
        ['Déductions', formatCurrency(payroll.deductions)],
        ['Salaire net', formatCurrency(payroll.net_salary)],
        ['Statut', payroll.status],
      ];

      await exportToPDFTable(
        `Bulletin de Paie`,
        headers,
        rows,
        `fiche-paie-${payroll.employee_name}-${payroll.period}`,
        {
          schoolName: schoolInfo?.name || 'Établissement',
          schoolAddress: schoolInfo?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
          schoolPhone: schoolInfo?.phone || '+225 0707905958',
          subtitle: `Période: ${payroll.period}`,
        }
      );
      toast.success('Fiche de paie téléchargée');
    } catch (error) {
      toast.error('Erreur lors de l\'export PDF');
      console.error(error);
    }
  }

  const handleSavePayroll = async () => {
    if (!editingPayroll) return;
    
    setIsSavingPayroll(true);
    try {
      const calculatedNetSalary = editingPayroll.base_salary + editingPayroll.bonuses - editingPayroll.deductions - editingPayroll.cnps - editingPayroll.irpp;
      
      const { error } = await supabase
        .from('payrolls')
        .update({
          base_salary: editingPayroll.base_salary,
          bonuses: editingPayroll.bonuses,
          deductions: editingPayroll.deductions,
          cnps: editingPayroll.cnps,
          irpp: editingPayroll.irpp,
          net_salary: calculatedNetSalary,
          status: editingPayroll.status,
          notes: editingPayroll.notes,
          payment_date: editingPayroll.status === 'PAID' ? new Date().toISOString() : null,
        })
        .eq('id', editingPayroll.id);

      if (error) throw error;

      // Mettre à jour la liste
      setPayrolls(payrolls.map(p => 
        p.id === editingPayroll.id 
          ? { ...editingPayroll, net_salary: calculatedNetSalary, payment_date: editingPayroll.status === 'PAID' ? new Date().toISOString() : null }
          : p
      ));

      setSelectedPayroll(null);
      setEditingPayroll(null);
      toast.success('Fiche de paie mise à jour');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingPayroll(false);
    }
  }

  const handleCalculateDeductions = (baseAmount: number) => {
    // CNPS: 5.2% du salaire de base (Côte d'Ivoire)
    const cnpsAmount = Math.round(baseAmount * 0.052);
    
    // IRPP: Progressif selon barème (simplifié: 10% au-dessus de 500k)
    let irppAmount = 0;
    if (baseAmount > 500000) {
      irppAmount = Math.round((baseAmount - 500000) * 0.10);
    }
    
    return { cnps: cnpsAmount, irpp: irppAmount };
  }

  const handleBatchPayment = async () => {
    if (selectedPayrolls.length === 0) {
      toast.error('Sélectionnez au moins une fiche');
      return;
    }

    setIsProcessingBatch(true);
    try {
      const { error } = await supabase
        .from('payrolls')
        .update({
          status: 'PAID',
          payment_date: new Date().toISOString(),
        })
        .in('id', selectedPayrolls);

      if (error) throw error;

      setPayrolls(payrolls.map(p =>
        selectedPayrolls.includes(p.id)
          ? { ...p, status: 'PAID' as const, payment_date: new Date().toISOString() }
          : p
      ));

      setSelectedPayrolls([]);
      toast.success(`${selectedPayrolls.length} fiche(s) marquée(s) comme payée(s)`);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du paiement groupé');
    } finally {
      setIsProcessingBatch(false);
    }
  }

  const handleExportPayrollPDFPro = async (payroll: Payroll) => {
    await handleExportPayrollPDF(payroll);
  }

  const filteredPayrolls = payrolls.filter((p) => {
    const matchesSearch = p.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBaseSalary = payrolls.reduce((sum, p) => sum + p.base_salary, 0);
  const totalNetSalary = payrolls.reduce((sum, p) => sum + p.net_salary, 0);
  const paidCount = payrolls.filter(p => p.status === 'PAID').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Gestion de la paie</h1>
          <p className="text-sm text-neutral-600">Salaires du personnel pour {selectedPeriod}</p>
        </div>
        <div className="flex gap-3">
          <Input
            type="month"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-48"
          />
          <Button onClick={generatePayroll} disabled={isGenerating || isLoading}>
            <Icons.Plus className="h-4 w-4 mr-2" />
            {isGenerating ? 'Génération en cours...' : 'Générer la paie'}
          </Button>
          <Button variant="outline" onClick={handleExportPayroll}>
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
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Icons.Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total employés</p>
              <p className="text-2xl font-bold text-neutral-900">{payrolls.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Icons.DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Salaire brut total</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalBaseSalary)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Icons.Check className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Salaire net total</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalNetSalary)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Icons.Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Payés</p>
              <p className="text-2xl font-bold text-neutral-900">{paidCount}/{payrolls.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters with Batch Payment */}
      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <Input
            placeholder="Rechercher un employé..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg"
          >
            <option value="all">Tous les statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="PROCESSED">Traité</option>
            <option value="PAID">Payé</option>
          </select>
          {selectedPayrolls.length > 0 && (
            <Button 
              onClick={handleBatchPayment}
              disabled={isProcessingBatch}
              className="ml-auto bg-green-600 hover:bg-green-700"
            >
              <Icons.Check className="h-4 w-4 mr-2" />
              {isProcessingBatch ? 'Traitement...' : `Marquer ${selectedPayrolls.length} comme payé`}
            </Button>
          )}
        </div>
      </Card>

      {/* Payroll Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={selectedPayrolls.length === filteredPayrolls.length && filteredPayrolls.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPayrolls(filteredPayrolls.map(p => p.id));
                      } else {
                        setSelectedPayrolls([]);
                      }
                    }}
                    className="rounded border-neutral-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Employé</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Période</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Salaire base</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Primes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Déductions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Salaire net</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-neutral-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-neutral-500">
                    Aucune fiche de paie trouvée. Cliquez sur "Générer la paie" pour commencer.
                  </td>
                </tr>
              ) : (
                filteredPayrolls.map((payroll) => (
                  <tr key={payroll.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPayrolls.includes(payroll.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPayrolls([...selectedPayrolls, payroll.id]);
                          } else {
                            setSelectedPayrolls(selectedPayrolls.filter(id => id !== payroll.id));
                          }
                        }}
                        className="rounded border-neutral-300"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{payroll.employee_name}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{payroll.period}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">{formatCurrency(payroll.base_salary)}</td>
                    <td className="px-6 py-4 text-sm text-green-600">+{formatCurrency(payroll.bonuses)}</td>
                    <td className="px-6 py-4 text-sm text-red-600">-{formatCurrency(payroll.deductions)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{formatCurrency(payroll.net_salary)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payroll.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        payroll.status === 'PROCESSED' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {payroll.status === 'PAID' ? 'Payé' :
                         payroll.status === 'PROCESSED' ? 'Traité' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedPayroll(payroll)}
                        title="Voir les détails"
                      >
                        <Icons.Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleExportPayrollPDF(payroll)}
                        title="Exporter en PDF"
                      >
                        <Icons.FileText className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal - Détails de la fiche de paie */}
      {selectedPayroll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{selectedPayroll.employee_name}</h2>
              <button
                onClick={() => {
                  setSelectedPayroll(null);
                  setEditingPayroll(null);
                }}
                className="text-neutral-400 hover:text-neutral-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {!editingPayroll ? (
              <>
                {/* Mode Lecture */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Période</span>
                    <span className="font-medium">{selectedPayroll.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Salaire de base</span>
                    <span className="font-medium">{formatCurrency(selectedPayroll.base_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Primes</span>
                    <span className="font-medium text-green-600">+{formatCurrency(selectedPayroll.bonuses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Déductions</span>
                    <span className="font-medium text-red-600">-{formatCurrency(selectedPayroll.deductions)}</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-3 flex justify-between">
                    <span className="font-bold">Salaire net</span>
                    <span className="font-bold text-neutral-900">{formatCurrency(selectedPayroll.net_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Statut</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedPayroll.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      selectedPayroll.status === 'PROCESSED' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selectedPayroll.status === 'PAID' ? 'Payé' :
                       selectedPayroll.status === 'PROCESSED' ? 'Traité' : 'Brouillon'}
                    </span>
                  </div>
                  {selectedPayroll.payment_date && (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Date de paiement</span>
                      <span className="font-medium">{formatDate(selectedPayroll.payment_date)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedPayroll(null)} className="flex-1">
                    Fermer
                  </Button>
                  <Button 
                    onClick={() => setEditingPayroll({ ...selectedPayroll })}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Modifier
                  </Button>
                  <Button onClick={() => {
                    handleExportPayrollPDFPro(selectedPayroll);
                    setSelectedPayroll(null);
                  }} className="flex-1">
                    <Icons.Download className="h-4 w-4 mr-2" />
                    PDF Pro
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Mode Édition */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Salaire de base</label>
                      <Input
                        type="number"
                        value={editingPayroll.base_salary}
                        onChange={(e) => {
                          const newBase = Number(e.target.value);
                          const deductions = handleCalculateDeductions(newBase);
                          setEditingPayroll({ 
                            ...editingPayroll, 
                            base_salary: newBase,
                            cnps: deductions.cnps,
                            irpp: deductions.irpp
                          });
                        }}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Primes/Bonus</label>
                      <Input
                        type="number"
                        value={editingPayroll.bonuses}
                        onChange={(e) => setEditingPayroll({ ...editingPayroll, bonuses: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Autres déductions</label>
                      <Input
                        type="number"
                        value={editingPayroll.deductions}
                        onChange={(e) => setEditingPayroll({ ...editingPayroll, deductions: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Salaire net (auto)</label>
                      <div className="px-3 py-2 bg-neutral-100 rounded-lg border border-neutral-300 font-medium text-sm">
                        {formatCurrency(editingPayroll.base_salary + editingPayroll.bonuses - editingPayroll.deductions - editingPayroll.cnps - editingPayroll.irpp)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">CNPS (5.2% auto)</label>
                      <Input
                        type="number"
                        value={editingPayroll.cnps}
                        onChange={(e) => setEditingPayroll({ ...editingPayroll, cnps: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">IRPP (progressif auto)</label>
                      <Input
                        type="number"
                        value={editingPayroll.irpp}
                        onChange={(e) => setEditingPayroll({ ...editingPayroll, irpp: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Notes/Observations</label>
                    <textarea
                      value={editingPayroll.notes || ''}
                      onChange={(e) => setEditingPayroll({ ...editingPayroll, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Ex: Retard de paie, bonus exceptionnels, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Statut du paiement</label>
                    <div className="flex gap-2">
                      {(['DRAFT', 'PROCESSED', 'PAID'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setEditingPayroll({ ...editingPayroll, status })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                            editingPayroll.status === status
                              ? status === 'PAID' ? 'bg-green-600 text-white' :
                                status === 'PROCESSED' ? 'bg-blue-600 text-white' :
                                'bg-yellow-600 text-white'
                              : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                          }`}
                        >
                          {status === 'DRAFT' ? 'Brouillon' :
                           status === 'PROCESSED' ? 'Traité' : 'Payé'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingPayroll(null)} 
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleSavePayroll}
                    disabled={isSavingPayroll}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isSavingPayroll ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
