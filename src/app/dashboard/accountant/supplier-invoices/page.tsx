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

interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_type: 'CIE' | 'SODECI' | 'WIFI' | 'OTHER';
  date: string;
  due_date: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  proof_document_url: string | null;
  notes: string;
  created_at: string;
}

export default function SupplierInvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: '',
    supplier_name: '',
    supplier_type: 'OTHER',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.school_id) {
      loadInvoices();
    }
  }, [user?.school_id]);

  async function loadInvoices() {
    if (!user?.school_id) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('school_id', user.school_id)
        .order('date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsUploading(true);
      let proofUrl = null;

      // Upload file if selected (optional - proof document)
      if (selectedFile) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `invoices/${user?.school_id}/${Date.now()}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(fileName, selectedFile);

          if (uploadError) {
            console.warn('File upload skipped - bucket not available');
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('invoices')
              .getPublicUrl(fileName);
            proofUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Could not upload file, continuing without proof document');
        }
      }

      // Check if invoice is overdue
      const status = new Date(formData.due_date) < new Date() ? 'OVERDUE' : 'PENDING';

      const { error } = await supabase.from('supplier_invoices').insert({
        school_id: user?.school_id,
        invoice_number: formData.invoice_number,
        supplier_name: formData.supplier_name,
        supplier_type: formData.supplier_type,
        date: formData.date,
        due_date: formData.due_date,
        amount: parseFloat(formData.amount),
        notes: formData.notes,
        status: status,
        proof_document_url: proofUrl,
      });

      if (error) throw error;
      toast.success('Facture ajoutée avec succès');
      setIsModalOpen(false);
      setFormData({
        invoice_number: '',
        supplier_name: '',
        supplier_type: 'OTHER',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: '',
        notes: '',
      });
      setSelectedFile(null);
      loadInvoices();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de l'ajout de la facture");
    } finally {
      setIsUploading(false);
    }
  }

  async function markAsPaid(invoiceId: string) {
    try {
      const { error } = await supabase
        .from('supplier_invoices')
        .update({ status: 'PAID' })
        .eq('id', invoiceId);

      if (error) throw error;
      toast.success('Facture marquée comme payée');
      loadInvoices();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  }

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = supplierFilter === 'all' || inv.supplier_type === supplierFilter;
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const pendingAmount = invoices.filter(inv => inv.status !== 'PAID').reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter(inv => inv.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Factures fournisseurs</h1>
          <p className="text-sm text-neutral-600">CIE, SODECI, WiFi et autres factures</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Icons.Plus className="h-4 w-4 mr-2" />
          Ajouter une facture
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Icons.FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total factures</p>
              <p className="text-2xl font-bold text-neutral-900">{invoices.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Icons.DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Montant total</p>
              <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Icons.AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">À payer</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
              <Icons.AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">En retard</p>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder="Rechercher une facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg"
          >
            <option value="all">Tous les fournisseurs</option>
            <option value="CIE">CIE (Électricité)</option>
            <option value="SODECI">SODECI (Eau)</option>
            <option value="WIFI">Internet/WiFi</option>
            <option value="OTHER">Autres</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="PAID">Payée</option>
            <option value="OVERDUE">En retard</option>
          </select>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">N° Facture</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Fournisseur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Échéance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Preuve</th>
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
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-neutral-500">
                    Aucune facture trouvée
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">{invoice.supplier_name}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.supplier_type === 'CIE' ? 'bg-yellow-100 text-yellow-700' :
                        invoice.supplier_type === 'SODECI' ? 'bg-blue-100 text-blue-700' :
                        invoice.supplier_type === 'WIFI' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {invoice.supplier_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(invoice.date)}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(invoice.due_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{formatCurrency(invoice.amount)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {invoice.status === 'PAID' ? 'Payée' :
                         invoice.status === 'PENDING' ? 'En attente' : 'En retard'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {invoice.proof_document_url ? (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(invoice.proof_document_url!, '_blank')}
                        >
                          <Icons.FileText className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">Aucune</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      {invoice.status !== 'PAID' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAsPaid(invoice.id)}
                        >
                          <Icons.Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
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
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Ajouter une facture fournisseur</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">N° Facture</label>
                  <Input
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="Ex: FAC-2026-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Type fournisseur</label>
                  <select
                    value={formData.supplier_type}
                    onChange={(e) => setFormData({ ...formData, supplier_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                    required
                  >
                    <option value="CIE">CIE (Électricité)</option>
                    <option value="SODECI">SODECI (Eau)</option>
                    <option value="WIFI">Internet/WiFi</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Nom du fournisseur</label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="Ex: CIE Côte d'Ivoire, SODECI Abidjan..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date facture</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date d'échéance</label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Montant (FCFA)</label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  rows={2}
                  placeholder="Notes supplémentaires..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Photo de la facture (obligatoire)
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="invoice-upload"
                    required
                  />
                  <label htmlFor="invoice-upload" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <Icons.Check className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{selectedFile.name}</p>
                          <p className="text-xs text-neutral-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Icons.FileText className="h-12 w-12 mx-auto text-neutral-400 mb-2" />
                        <p className="text-sm font-medium text-neutral-900">Cliquez pour ajouter la facture</p>
                        <p className="text-xs text-neutral-500 mt-1">Photo ou PDF (requis)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={isUploading}>
                  {isUploading ? 'Envoi en cours...' : 'Ajouter'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
