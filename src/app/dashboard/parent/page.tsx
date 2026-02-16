'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { exportToPDFTable } from '@/utils/exportUtils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

export default function ParentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [secretary, setSecretary] = useState<any>(null);

  useEffect(() => {
    checkPasswordChange();
    loadDashboardData();
  }, [user, selectedChild]);

  // Abonnement aux changements des enfants du parent
  useRealtimeSubscription({
    table: 'parents_students',
    event: '*',
    filter: `parent_id=eq.${user?.id}`,
    onData: () => {
      loadDashboardData();
    },
    enabled: !!user?.id,
  });

  // Abonnement aux changements des factures
  useRealtimeSubscription({
    table: 'invoices',
    event: '*',
    onData: () => {
      loadDashboardData();
    },
    enabled: !!user?.id,
  });

  // Abonnement aux changements des paiements
  useRealtimeSubscription({
    table: 'payments',
    event: '*',
    onData: () => {
      loadDashboardData();
    },
    enabled: !!user?.id,
  });

  async function checkPasswordChange() {
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('must_change_password')
      .eq('id', user.id)
      .single();

    if (userData?.must_change_password) {
      setMustChangePassword(true);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    
    if (!user) return;

    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Mettre à jour le mot de passe Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) throw authError;

      // Mettre à jour must_change_password dans users
      const { error: updateError } = await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Mot de passe changé avec succès!');
      setMustChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du changement de mot de passe');
      console.error(error);
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function loadDashboardData() {
    if (!user) return;

    try {
      // Charger les enfants du parent
      const { data: childrenData } = await supabase
        .from('parents_students')
        .select(`
          *,
          student:students (
            *,
            class:classes (
              id,
              name,
              level
            )
          )
        `)
        .eq('parent_id', user.id);

      if (childrenData) {
        setChildren(childrenData.map(ps => ps.student));

        const studentIds = childrenData.map(ps => ps.student_id);

        // Définir le premier enfant par défaut
        if (!selectedChild && studentIds.length > 0) {
          setSelectedChild(studentIds[0]);
        }

        // Charger l'historique de présence pour l'enfant sélectionné
        if (selectedChild) {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('*, students(first_name, last_name)')
            .eq('student_id', selectedChild)
            .order('date', { ascending: false })
            .limit(30);

          if (attendanceData) {
            setAttendanceHistory(attendanceData);
          }
        }

        // Charger les factures en attente
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('*')
          .in('student_id', studentIds)
          .in('status', ['SENT', 'OVERDUE'])
          .order('due_date', { ascending: true })
          .limit(5);

        if (invoicesData) {
          setPendingInvoices(invoicesData);
        }

        // Charger les paiements récents
        const { data: paymentsData } = await supabase
          .from('payments')
          .select(`
            *,
            invoice:invoices (
              invoice_number
            )
          `)
          .in('student_id', studentIds)
          .eq('status', 'COMPLETED')
          .order('payment_date', { ascending: false })
          .limit(5);

        if (paymentsData) {
          setRecentPayments(paymentsData);
        }
      }

      // Charger les informations de l'école
      if (user?.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('id, name, phone, email, address')
          .eq('id', user.school_id)
          .single();

        if (schoolData) {
          setSchoolInfo(schoolData);
        }

        // Charger les données de la secrétaire
        const { data: secretaryData } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('school_id', user.school_id)
          .eq('role', 'SECRETARY')
          .single();

        if (secretaryData) {
          setSecretary(secretaryData);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="animate-pulse">Chargement...</div>;
  }

  const totalDue = pendingInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const overdueCount = pendingInvoices.filter((invoice) => invoice.status === 'OVERDUE').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-rose-50">
      {/* Modal de changement de mot de passe obligatoire */}
      {mustChangePassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-warning-100 flex items-center justify-center">
                  <Icons.Settings className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Changement de mot de passe requis</h2>
                  <p className="text-sm text-neutral-600">Pour votre sécurité, veuillez changer votre mot de passe</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Nouveau mot de passe *
                  </label>
                  <Input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Confirmer le mot de passe *
                  </label>
                  <Input
                    type="password"
                    placeholder="Retapez le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="bg-info-50 border border-info-200 rounded-lg p-3">
                  <p className="text-xs text-info-700">
                    <strong>Votre mot de passe actuel:</strong> Parent123!<br/>
                    Choisissez un mot de passe fort et unique que vous pourrez mémoriser.
                  </p>
                </div>

                <Button type="submit" disabled={isChangingPassword} className="w-full">
                  {isChangingPassword ? 'Changement en cours...' : 'Changer le mot de passe'}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
      <div className="relative overflow-hidden pb-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.16),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.14),transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Parent</span>
              <h1 className="text-3xl font-semibold text-neutral-900">Bonjour, {user?.full_name}</h1>
              <p className="text-sm text-neutral-600 max-w-2xl">Suivez la scolarité, les factures et les paiements de vos enfants.</p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Calendar className="w-3.5 h-3.5 text-neutral-700" /> {new Date().toLocaleDateString('fr-FR')}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Activity className="w-3.5 h-3.5 text-emerald-600" /> {children.length} enfant(s)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {pendingInvoices.length} facture(s)
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button variant="outline" onClick={loadDashboardData}>
                <Icons.Activity className="w-4 h-4 mr-2" /> Rafraîchir
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* School Contact Information */}
        <Card className="border border-orange-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                  <Icons.Phone className="w-5 h-5 text-orange-600" /> Contacts de l'école
                </h2>
                <p className="text-sm text-neutral-600">Numéros utiles de votre école</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schoolInfo && (
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-neutral-200">
                  <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                    <Icons.Building className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-700">École</p>
                    <p className="text-xs text-neutral-600 mb-1">{schoolInfo.name}</p>
                    {schoolInfo.phone && (
                      <a href={`tel:${schoolInfo.phone}`} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                        📞 {schoolInfo.phone}
                      </a>
                    )}
                    {schoolInfo.email && (
                      <a href={`mailto:${schoolInfo.email}`} className="text-xs text-orange-600 hover:text-orange-700 block mt-1">
                        ✉️ {schoolInfo.email}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {secretary && (
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-neutral-200">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Icons.User className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-700">Secrétaire</p>
                    <p className="text-xs text-neutral-600 mb-1">{secretary.full_name}</p>
                    {secretary.phone && (
                      <a href={`tel:${secretary.phone}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        📞 {secretary.phone}
                      </a>
                    )}
                    {secretary.email && (
                      <a href={`mailto:${secretary.email}`} className="text-xs text-blue-600 hover:text-blue-700 block mt-1">
                        ✉️ {secretary.email}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <Card className="border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Actions rapides</h2>
                <p className="text-sm text-neutral-600">Accès direct aux factures, paiements et messages.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[{
                title: 'Factures',
                description: 'Consulter mes factures',
                icon: Icons.FileText,
                href: '/dashboard/parent/invoices',
              }, {
                title: 'Notes & bulletins',
                description: 'Résultats et appréciations',
                icon: Icons.BarChart,
                href: '/dashboard/parent/grades',
              }, {
                title: 'Messages',
                description: 'Contacter l’école',
                icon: Icons.Mail,
                href: '/dashboard/parent/messages',
              }, {
                title: 'Planning',
                description: 'Emploi du temps',
                icon: Icons.Calendar,
                href: '/dashboard/parent/timetable',
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
          </div>
        </Card>

        {/* Alertes & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-red-500 bg-red-50 border border-red-200">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Icons.AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Factures en retard</h3>
                  <p className="text-2xl font-bold text-red-700">{overdueCount}</p>
                  <p className="text-sm text-red-600 mt-1">À régler rapidement</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 border border-yellow-200">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Icons.FileText className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-1">Factures en attente</h3>
                  <p className="text-2xl font-bold text-yellow-700">{pendingInvoices.length - overdueCount}</p>
                  <p className="text-sm text-yellow-600 mt-1">{formatCurrency(totalDue)} au total</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-green-50 border border-green-200">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Icons.CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Derniers paiements</h3>
                  <p className="text-2xl font-bold text-green-700">{recentPayments.length}</p>
                  <p className="text-sm text-green-600 mt-1">Ce mois-ci</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Mes enfants */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {children.map((child) => (
            <Card
              key={child.id}
              className={`p-6 border shadow-sm cursor-pointer transition-all ${
                selectedChild === child.id
                  ? 'border-primary-500 bg-primary-50 shadow-lg'
                  : 'border-neutral-200 bg-white hover:border-primary-300'
              }`}
              onClick={() => setSelectedChild(child.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-xl text-white flex items-center justify-center shadow-sm ${
                  selectedChild === child.id ? 'bg-primary-600' : 'bg-neutral-900'
                }`}>
                  <Icons.Student className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">
                    {child.first_name} {child.last_name}
                  </h3>
                  <p className="text-sm text-neutral-600">{child.class?.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700 mt-1">
                    {child.status}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Historique de présence */}
        {selectedChild && (
          <Card className="border border-neutral-200 shadow-sm bg-white">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Historique de présence</h2>
                  <p className="text-sm text-neutral-600">30 derniers jours</p>
                </div>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <Icons.CheckCircle className="w-3 h-3 mr-1" />
                    Présent
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <Icons.AlertCircle className="w-3 h-3 mr-1" />
                    Absent
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    <Icons.Clock className="w-3 h-3 mr-1" />
                    Retard
                  </span>
                </div>
              </div>

              {attendanceHistory.length === 0 ? (
                <div className="p-6 text-center text-neutral-500">
                  Aucune donnée de présence disponible
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-neutral-700">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-neutral-700">Séance</th>
                        <th className="text-left px-4 py-3 font-semibold text-neutral-700">Statut</th>
                        <th className="text-left px-4 py-3 font-semibold text-neutral-700">Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {attendanceHistory.map((attendance) => (
                        <tr key={attendance.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3">{formatDate(attendance.date)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                              {attendance.session === 'MORNING' ? 'Matin' : 'Après-midi'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                attendance.status === 'PRESENT'
                                  ? 'bg-green-100 text-green-800'
                                  : attendance.status === 'ABSENT'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {attendance.status === 'PRESENT' ? 'Présent' : attendance.status === 'ABSENT' ? 'Absent' : 'Retard'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {attendance.reason || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Factures en attente */}
        <Card className="border border-neutral-200 shadow-sm bg-white">
          <CardHeader title="Factures en attente" description={`Total dû: ${formatCurrency(totalDue)}`} />
          {pendingInvoices.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">
              Aucune facture en attente
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {pendingInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{invoice.invoice_number}</p>
                      <p className="text-sm text-neutral-600">
                        Échéance: {formatDate(invoice.due_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-neutral-900">
                        {formatCurrency(invoice.total)}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        invoice.status === 'OVERDUE'
                          ? 'bg-danger-100 text-danger-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}>
                        {invoice.status === 'OVERDUE' ? 'En retard' : 'En attente'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Paiements récents */}
        <Card className="border border-neutral-200 shadow-sm bg-white">
          <CardHeader title="Paiements récents" />
          {recentPayments.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">
              Aucun paiement récent
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{payment.payment_number}</p>
                      <p className="text-sm text-neutral-600">
                        {formatDate(payment.payment_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success-600">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-neutral-500">{payment.payment_method}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={async () => {
                          try {
                            const headers = ['Description', 'Montant', 'Date', 'Méthode'];
                            const rows = [
                              [
                                'Paiement de scolarité',
                                formatCurrency(payment.amount),
                                payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : 'N/A',
                                payment.payment_method,
                              ],
                            ];

                            await exportToPDFTable(
                              'Reçu de Paiement',
                              headers,
                              rows,
                              `recu_paiement_${new Date().toISOString().split('T')[0]}`,
                              {
                                schoolName: schoolInfo?.name || 'Établissement',
                                schoolAddress: schoolInfo?.address || 'Bingerville (Cefal après Adjamé-Bingerville)',
                                schoolPhone: schoolInfo?.phone || '+225 0707905958',
                                subtitle: payment.payment_number || undefined,
                              }
                            );
                            toast.success('Reçu PDF téléchargé');
                          } catch (error) {
                            toast.error('Erreur lors de la génération du reçu');
                            console.error(error);
                          }
                        }}
                      >
                        <Icons.FileText className="w-3 h-3 mr-1" />
                        Reçu PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>

        <Card className="border border-neutral-200 shadow-sm bg-neutral-900 text-white">
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold mb-1">Rappels</p>
              <p className="text-neutral-300">{overdueCount} facture(s) en retard à régler rapidement.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Contacts</p>
              <p className="text-neutral-300">Utilisez Messages pour joindre la direction ou les enseignants.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Sécurité</p>
              <p className="text-neutral-300">Gardez vos identifiants à jour et changez le mot de passe régulièrement.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
