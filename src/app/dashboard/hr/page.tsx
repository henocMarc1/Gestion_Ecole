'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface HRStats {
  totalStaff: number;
  teachers: number;
  activeClasses: number;
  attendanceToday: number;
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  salary?: number;
  employee?: {
    position?: string;
    hire_date?: string;
    employment_type?: string;
    status?: string;
  };
}

interface ClassAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject: string | null;
  is_main_teacher: boolean;
  teacher_name: string;
  class_name: string;
}

function HRDashboard({
  initialTab = 'overview',
}: {
  initialTab?: 'overview' | 'staff' | 'assignments' | 'reports';
}) {
  const [stats, setStats] = useState<HRStats>({
    totalStaff: 0,
    teachers: 0,
    activeClasses: 0,
    attendanceToday: 0,
  });
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'assignments' | 'reports'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'role' | 'salary'>('name-asc');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Abonnement aux changements du staff
  useRealtimeSubscription({
    table: 'users',
    event: 'UPDATE',
    onData: () => {
      loadData();
    },
    enabled: true,
  });

  // Abonnement aux changements des assignments prof-classe
  useRealtimeSubscription({
    table: 'teacher_classes',
    event: '*',
    onData: () => {
      loadData();
    },
    enabled: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's school_id
      const { data: userData } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (!userData?.school_id) {
        toast.error('Vous n\'avez pas d\'école assignée');
        return;
      }

      // Load staff with employee details and salary
      const { data: staffData, error: staffError } = await supabase
        .from('users')
        .select('id, full_name, email, role, phone, is_active, salary, employee:employees(position, hire_date, employment_type, status)')
        .eq('school_id', userData.school_id)
        .is('deleted_at', null)
        .neq('role', 'PARENT')
        .neq('role', 'SUPER_ADMIN')
        .order('full_name');

      if (staffError) throw staffError;
      setStaff(
        (staffData || []).map((item: any) => ({
          ...item,
          employee: Array.isArray(item.employee) ? item.employee[0] : item.employee,
        }))
      );

      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', userData.school_id)
        .is('deleted_at', null)
        .order('name');

      if (classesError) throw classesError;

      // Load assignments with teacher names
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('teacher_classes')
        .select(`
          id,
          teacher_id,
          class_id,
          subject,
          is_main_teacher,
          users!teacher_id(full_name),
          classes!class_id(name, school_id, deleted_at)
        `)
        .in('class_id', classesData?.map(c => c.id) || []);

      if (assignmentsError) throw assignmentsError;

      const formattedAssignments = (assignmentsData || [])
        .filter((a: any) => a.classes?.school_id === userData.school_id && !a.classes?.deleted_at)
        .map((a: any) => ({
          id: a.id,
          teacher_id: a.teacher_id,
          class_id: a.class_id,
          subject: a.subject,
          is_main_teacher: a.is_main_teacher,
          teacher_name: a.users?.full_name || 'N/A',
          class_name: a.classes?.name || 'N/A',
        }));

      setAssignments(formattedAssignments);

      // Calculate stats
      const teachers = staffData?.filter(s => s.role === 'TEACHER').length || 0;

      // Get staff attendance today from attendance_records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('date', new Date().toISOString().split('T')[0])
        .eq('status', 'present');

      // If attendance_records doesn't exist or is empty, try counting student attendance instead
      let attendanceCount = 0;
      if (attendanceError) {
        console.warn('Erreur attendance_records, tentative avec attendance étudiants:', attendanceError);
        const { data: studentAttendance } = await supabase
          .from('attendance')
          .select('id')
          .eq('date', new Date().toISOString().split('T')[0])
          .eq('status', 'PRESENT')
          .in('class_id', classesData?.map(c => c.id) || []);
        attendanceCount = studentAttendance?.length || 0;
      } else {
        attendanceCount = attendanceData?.length || 0;
      }

      setStats({
        totalStaff: staffData?.length || 0,
        teachers,
        activeClasses: classesData?.length || 0,
        attendanceToday: attendanceCount,
      });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce personnel?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', staffId);

      if (error) throw error;
      toast.success('Personnel supprimé');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette affectation?')) return;

    try {
      const { error } = await supabase
        .from('teacher_classes')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      toast.success('Affectation supprimée');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        <p className="text-sm text-neutral-600 mt-3">Chargement...</p>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-orange-50">
      {/* Header Section */}
      <div className="relative overflow-hidden pb-4">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                Ressources humaines
              </span>
              <h1 className="text-3xl font-semibold text-neutral-900">Pilotage du personnel</h1>
              <p className="text-sm text-neutral-600 max-w-2xl">
                Gérez le staff, les affectations et surveillez les présences de la journée.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Users className="w-3.5 h-3.5 text-neutral-700" /> {stats.totalStaff} personnel
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.BookOpen className="w-3.5 h-3.5 text-blue-600" /> {stats.activeClasses} classes
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Calendar className="w-3.5 h-3.5 text-emerald-600" /> Présences: {stats.attendanceToday}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadData}>
                <Icons.Activity className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-neutral-200 overflow-x-auto relative z-10 bg-white sticky top-16">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Icons.Home className="w-4 h-4 inline mr-2" />
            Aperçu
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'staff'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Icons.Users className="w-4 h-4 inline mr-2" />
            Personnel
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'assignments'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Icons.FileText className="w-4 h-4 inline mr-2" />
            Affectations
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'reports'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Icons.BarChart className="w-4 h-4 inline mr-2" />
            Rapports
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border border-neutral-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Personnel total</p>
                    <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.totalStaff}</p>
                    <p className="text-xs text-neutral-500 mt-1">Tous rôles confondus</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Icons.Users className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </Card>

              <Card className="border border-neutral-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Enseignants</p>
                    <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.teachers}</p>
                    <p className="text-xs text-neutral-500 mt-1">Corps enseignant</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Icons.BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </Card>

              <Card className="border border-neutral-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Classes actives</p>
                    <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.activeClasses}</p>
                    <p className="text-xs text-neutral-500 mt-1">En cours</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Icons.Building className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </Card>

              <Card className="border border-neutral-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Présences aujourd'hui</p>
                    <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.attendanceToday}</p>
                    <p className="text-xs text-neutral-500 mt-1">{new Date().toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Icons.Check className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Actions and Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border border-neutral-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-3">Actions rapides</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('staff')}
                  >
                    <Icons.Users className="w-4 h-4 mr-2" />
                    Gérer le personnel
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('assignments')}
                  >
                    <Icons.Calendar className="w-4 h-4 mr-2" />
                    Voir les affectations
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('reports')}
                  >
                    <Icons.Download className="w-4 h-4 mr-2" />
                    Générer un rapport
                  </Button>
                </div>
              </Card>

              <Card className="border border-neutral-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-3">Statistiques du mois</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-600">Personnel actif</span>
                    <span className="font-semibold text-neutral-900">
                      {staff.filter(s => s.is_active).length} / {stats.totalStaff}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-600">Taux d'affectation</span>
                    <span className="font-semibold text-green-600">
                      {stats.teachers > 0 ? Math.round((assignments.length / stats.teachers) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Enseignants principaux</span>
                    <span className="font-semibold text-neutral-900">
                      {assignments.filter(a => a.is_main_teacher).length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Info Box */}
            <Card className="border border-orange-200 bg-orange-50 shadow-sm p-6">
              <div className="flex gap-3">
                <Icons.Info className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-orange-900 mb-1">À propos de votre rôle</h3>
                  <p className="text-sm text-orange-800">
                    En tant que Responsable RH, vous pouvez gérer le personnel de votre école, les affectations de classes et les présences. Vous n'avez pas accès aux finances.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <Card className="border border-neutral-200 shadow-sm">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">
                  Personnel de l'école ({staff.length})
                </h2>
              </div>
              
              {/* Filters and Sort */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">Tous les rôles</option>
                  <option value="TEACHER">Enseignants</option>
                  <option value="ADMIN">Directeurs</option>
                  <option value="SECRETARY">Secrétaires</option>
                  <option value="ACCOUNTANT">Comptables</option>
                  <option value="HR">RH</option>
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="ACTIVE">Actifs</option>
                  <option value="INACTIVE">Inactifs</option>
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="name-asc">Nom (A → Z)</option>
                  <option value="name-desc">Nom (Z → A)</option>
                  <option value="role">Rôle</option>
                  <option value="salary">Salaire</option>
                </select>
              </div>

              {staff.length === 0 ? (
                <div className="text-center py-12">
                  <Icons.Users className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600 font-medium">Aucun personnel</p>
                  <p className="text-sm text-neutral-500 mt-1">Commencez par ajouter des membres du personnel</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Nom complet</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Poste</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Rôle</th>
                        <th className="text-right py-3 px-4 font-semibold text-neutral-700">Salaire</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Téléphone</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Statut</th>
                        <th className="text-right py-3 px-4 font-semibold text-neutral-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff
                        .filter(s => {
                          const matchesSearch = searchTerm === '' || 
                            s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.email.toLowerCase().includes(searchTerm.toLowerCase());
                          const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
                          const matchesStatus = statusFilter === 'ALL' || 
                            (statusFilter === 'ACTIVE' && s.is_active) || 
                            (statusFilter === 'INACTIVE' && !s.is_active);
                          return matchesSearch && matchesRole && matchesStatus;
                        })
                        .sort((a, b) => {
                          switch(sortBy) {
                            case 'name-asc':
                              return a.full_name.localeCompare(b.full_name, 'fr-FR');
                            case 'name-desc':
                              return b.full_name.localeCompare(a.full_name, 'fr-FR');
                            case 'role':
                              return a.role.localeCompare(b.role);
                            case 'salary':
                              return (b.salary || 0) - (a.salary || 0);
                            default:
                              return 0;
                          }
                        })
                        .map((s) => {
                          const roleLabels: Record<string, string> = {
                            ADMIN: 'Directeur',
                            TEACHER: 'Enseignant',
                            SECRETARY: 'Secrétaire',
                            ACCOUNTANT: 'Comptable',
                            HR: 'RH'
                          };
                          const roleColors: Record<string, string> = {
                            ADMIN: 'bg-purple-100 text-purple-700',
                            TEACHER: 'bg-blue-100 text-blue-700',
                            SECRETARY: 'bg-green-100 text-green-700',
                            ACCOUNTANT: 'bg-yellow-100 text-yellow-700',
                            HR: 'bg-orange-100 text-orange-700'
                          };

                          const initials = s.full_name.split(' ').map(n => n[0]).slice(0, 2).join('');
                          
                          return (
                            <tr 
                              key={s.id} 
                              onClick={() => setSelectedStaff(s)}
                              className="border-b border-neutral-100 hover:bg-orange-50 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-medium text-xs">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="text-neutral-900 font-medium">{s.full_name}</div>
                                    <div className="text-xs text-neutral-500">{s.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-neutral-600 text-sm">{s.employee?.position || '-'}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[s.role] || 'bg-neutral-100 text-neutral-700'}`}>
                                  {roleLabels[s.role] || s.role}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-neutral-900">
                                {s.salary ? `${(s.salary).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF` : '-'}
                              </td>
                              <td className="py-3 px-4 text-neutral-600 text-sm">{s.phone || '-'}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    s.is_active
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-neutral-100 text-neutral-700'
                                  }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-neutral-500'}`} />
                                  {s.is_active ? 'Actif' : 'Inactif'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteStaff(s.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Icons.Trash className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <Card className="border border-neutral-200 shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Affectations des enseignants ({assignments.length})
              </h2>

              {assignments.length === 0 ? (
                <div className="text-center py-12">
                  <Icons.FileText className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600 font-medium">Aucune affectation</p>
                  <p className="text-sm text-neutral-500 mt-1">Les affectations apparaîtront ici</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Enseignant</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Classe</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Matière</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Type</th>
                        <th className="text-right py-3 px-4 font-semibold text-neutral-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => (
                        <tr key={a.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Icons.Users className="w-4 h-4 text-neutral-400" />
                              <span className="text-neutral-900 font-medium">{a.teacher_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Icons.Building className="w-4 h-4 text-neutral-400" />
                              <span className="text-neutral-600">{a.class_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-neutral-600 text-sm">{a.subject || '-'}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                a.is_main_teacher
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {a.is_main_teacher ? 'Principal' : 'Intervenant'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </Button>
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

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <Card className="border border-neutral-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Rapports et Statistiques</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border border-neutral-200 rounded-lg p-4 hover:border-orange-300 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icons.FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-medium text-neutral-900">Rapport du personnel</h3>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">
                    Liste complète du personnel avec rôles et statuts
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Icons.Download className="w-4 h-4 mr-2" />
                    Générer PDF
                  </Button>
                </div>

                <div className="border border-neutral-200 rounded-lg p-4 hover:border-orange-300 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Icons.Calendar className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-medium text-neutral-900">Affectations</h3>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">
                    Toutes les affectations enseignants-classes
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Icons.Download className="w-4 h-4 mr-2" />
                    Exporter Excel
                  </Button>
                </div>

                <div className="border border-neutral-200 rounded-lg p-4 hover:border-orange-300 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Icons.BarChart className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-medium text-neutral-900">Statistiques</h3>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">
                    Vue d'ensemble avec graphiques et métriques
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Icons.Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border border-neutral-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Statistiques détaillées</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-neutral-600 mb-3">Répartition par rôle</h3>
                  <div className="space-y-2">
                    {['ADMIN', 'TEACHER', 'SECRETARY', 'ACCOUNTANT', 'HR'].map(role => {
                      const count = staff.filter(s => s.role === role).length;
                      const percentage = stats.totalStaff > 0 ? Math.round((count / stats.totalStaff) * 100) : 0;
                      const roleLabels: Record<string, string> = {
                        ADMIN: 'Directeurs',
                        TEACHER: 'Enseignants',
                        SECRETARY: 'Secrétaires',
                        ACCOUNTANT: 'Comptables',
                        HR: 'RH'
                      };
                      
                      return (
                        <div key={role}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-neutral-600">{roleLabels[role]}</span>
                            <span className="font-medium text-neutral-900">{count}</span>
                          </div>
                          <div className="w-full bg-neutral-100 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-600 mb-3">Statut du personnel</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm text-neutral-600">Actifs</span>
                      <span className="text-xl font-bold text-green-700">
                        {staff.filter(s => s.is_active).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-neutral-50 rounded-lg">
                      <span className="text-sm text-neutral-600">Inactifs</span>
                      <span className="text-xl font-bold text-neutral-700">
                        {staff.filter(s => !s.is_active).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-600 mb-3">Affectations</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-neutral-600">Total</span>
                      <span className="text-xl font-bold text-blue-700">{assignments.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm text-neutral-600">Principaux</span>
                      <span className="text-xl font-bold text-orange-700">
                        {assignments.filter(a => a.is_main_teacher).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Staff Detail Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedStaff(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
            <Card className="border border-neutral-200 shadow-lg">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-neutral-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
                    {selectedStaff.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">{selectedStaff.full_name}</h2>
                    <p className="text-xs text-neutral-600">{selectedStaff.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStaff(null)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Role and Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Rôle</label>
                    <p className="text-sm text-neutral-900 mt-1">
                      {{
                        ADMIN: 'Directeur',
                        TEACHER: 'Enseignant',
                        SECRETARY: 'Secrétaire',
                        ACCOUNTANT: 'Comptable',
                        HR: 'Ressources Humaines'
                      }[selectedStaff.role] || selectedStaff.role}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700">Statut</label>
                    <span className={`inline-flex items-center gap-2 mt-1 px-2 py-1 rounded text-xs font-medium ${selectedStaff.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-700'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedStaff.is_active ? 'bg-green-500' : 'bg-neutral-500'}`} />
                      {selectedStaff.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className="font-semibold text-sm text-neutral-900 mb-2">Informations de Contact</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-neutral-600">Email</label>
                      <p className="text-sm text-neutral-900">{selectedStaff.email}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-600">Téléphone</label>
                      <p className="text-sm text-neutral-900">{selectedStaff.phone || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Employee Details */}
                {selectedStaff.employee && (
                  <div className="border-t border-neutral-200 pt-4">
                    <h3 className="font-semibold text-sm text-neutral-900 mb-2">Informations RH</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-600">Poste</label>
                        <p className="text-sm text-neutral-900">{selectedStaff.employee.position || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-600">Type d'emploi</label>
                        <p className="text-sm text-neutral-900">{selectedStaff.employee.employment_type || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-600">Date d'embauche</label>
                        <p className="text-sm text-neutral-900">
                          {selectedStaff.employee.hire_date 
                            ? new Date(selectedStaff.employee.hire_date).toLocaleDateString('fr-FR')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-600">Statut RH</label>
                        <p className="text-sm text-neutral-900">{selectedStaff.employee.status || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Salary */}
                <div className="border-t border-neutral-200 pt-4 bg-orange-50 rounded p-3">
                  <label className="text-xs font-semibold text-neutral-700">Salaire Annuel</label>
                  <p className="text-lg font-bold text-orange-700 mt-1">
                    {selectedStaff.salary 
                      ? `${(selectedStaff.salary).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF`
                      : 'Non défini'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end border-t border-neutral-200 pt-4">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedStaff(null)}
                  >
                    Fermer
                  </Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                    Modifier
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HRPage() {
  return <HRDashboard initialTab="overview" />;
}
