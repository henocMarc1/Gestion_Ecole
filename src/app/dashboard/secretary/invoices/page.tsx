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

interface Invoice {
  id: string;
  student_id: string;
  invoice_number: string;
  total: number;
  status: string;
  issue_date: string;
  due_date: string;
  created_at: string;
  student?: { first_name: string; last_name: string };
}

export default function InvoicesSPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    student_id: '',
    total: '',
    due_date: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  // Abonnement aux changements des factures
  useRealtimeSubscription({
    table: 'invoices',
    event: '*',
    filter: `school_id=eq.${user?.school_id}`,
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!user?.school_id,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newInvoice = payload.new as Invoice;
    const oldInvoice = payload.old as Invoice;

    switch (payload.eventType) {
      case 'INSERT':
        setInvoices(prev => [newInvoice, ...prev]);
        toast.success('Nouvelle facture ajoutée');
        break;
      case 'UPDATE':
        setInvoices(prev =>
          prev.map(inv => inv.id === newInvoice.id ? { ...inv, ...newInvoice } : inv)
        );
        toast.success('Facture mise à jour');
        break;
      case 'DELETE':
        setInvoices(prev => prev.filter(inv => inv.id !== oldInvoice.id));
        toast.success('Facture supprimée');
        break;
    }
  };

  const loadData = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const [invoicesRes, studentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, student:students(first_name, last_name)')
          .eq('school_id', user.school_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('school_id', user.school_id)
          .is('deleted_at', null),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (studentsRes.error) throw studentsRes.error;

      setInvoices(invoicesRes.data || []);
      setStudents(studentsRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id || !formData.total || !formData.due_date) {
      toast.error('Tous les champs requis');
      return;
    }

    setIsCreating(true);
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const { error } = await supabase.from('invoices').insert([{
        school_id: user?.school_id,
        student_id: formData.student_id,
        invoice_number: invoiceNumber,
        total: parseFloat(formData.total),
        subtotal: parseFloat(formData.total),
        issue_date: new Date().toISOString().split('T')[0],
        due_date: formData.due_date,
        status: 'SENT',
        created_by: user?.id,
      }]);

      if (error) throw error;
      toast.success('Facture créée');
      setFormData({ student_id: '', total: '', due_date: '' });
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Gestion des factures</h1>
        <p className="text-sm text-neutral-600 mt-1">Créez et suivez les factures des élèves</p>
      </div>

      {/* Formulaire */}
      <Card className="border border-neutral-200 shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Nouvelle facture</h2>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sélectionner un élève</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Montant total"
                step="0.01"
                value={formData.total}
                onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="date"
                placeholder="Date d'échéance"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Création...' : 'Créer la facture'}
            </Button>
          </form>
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
                      {formatCurrency(invoice.total)}
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
