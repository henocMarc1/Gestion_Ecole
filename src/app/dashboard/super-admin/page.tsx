'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast, Toaster } from 'sonner';


interface DashboardStats {
  totalSchools: number;
  activeSchools: number;
  totalUsers: number;
  totalStudents: number;
  usersByRole: Record<string, number>;
  recentActivity: any[];
}

export default function SuperAdminDashboard() {
  const router = useRouter();
    const { user, signOut } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
      totalSchools: 0,
      activeSchools: 0,
      totalUsers: 0,
      totalStudents: 0,
      usersByRole: {},
      recentActivity: [],
    });
    const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    setIsLoading(true);
    try {
      // Load schools
      const { data: schools, count: schoolsCount } = await supabase
        .from('schools')
        .select('*', { count: 'exact' })
        .is('deleted_at', null);

      const activeSchools = schools?.filter(s => s.is_active).length || 0;

      // Load users
      const { data: users, count: usersCount } = await supabase
        .from('users')
        .select('role', { count: 'exact' })
        .is('deleted_at', null);

      // Count users by role
      if (users) {
        const roleCounts: Record<string, number> = {};
        users.forEach((user) => {
          roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
        });

        // Load students
        const { count: studentsCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null);

        setStats({
          totalSchools: schoolsCount || 0,
          activeSchools,
          totalUsers: usersCount || 0,
          totalStudents: studentsCount || 0,
          usersByRole: roleCounts,
          recentActivity: [],
        });
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-indigo-50">
        <div className="relative overflow-hidden pb-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(79,70,229,0.18),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(16,185,129,0.16),transparent_40%)]" />

          {/* Header */}
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                Super Admin
              </span>
              <h1 className="text-3xl font-bold text-neutral-900">Tableau de bord global</h1>
              <p className="text-sm text-neutral-600 max-w-2xl">
                Surveillez la santé de la plateforme, les écoles actives et la répartition des utilisateurs.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Activity className="w-3.5 h-3.5 text-emerald-600" /> {stats.activeSchools} écoles actives
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Users className="w-3.5 h-3.5 text-neutral-700" /> {stats.totalUsers} utilisateurs
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Calendar className="w-3.5 h-3.5 text-neutral-700" /> Mise à jour {new Date().toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-neutral-600">Connecté en tant que</p>
              <p className="font-semibold text-neutral-900">{user?.full_name}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => loadDashboardStats()}>
                  <Icons.Activity className="h-4 w-4 mr-2" /> Rafraîchir
                </Button>
                <Button variant="outline" onClick={() => router.push('/dashboard/profile')}>
                  <Icons.Settings className="h-4 w-4 mr-2" /> Profil
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[{
              title: 'Total Écoles',
              value: stats.totalSchools,
              accent: 'bg-indigo-600',
              chip: `${stats.activeSchools} actives`,
              icon: Icons.Building,
            }, {
              title: 'Utilisateurs',
              value: stats.totalUsers,
              accent: 'bg-emerald-600',
              chip: 'Comptes actifs',
              icon: Icons.Users,
            }, {
              title: 'Élèves',
              value: stats.totalStudents,
              accent: 'bg-purple-600',
              chip: 'Population',
              icon: Icons.Student,
            }, {
              title: 'Statut Système',
              value: 'Opérationnel',
              accent: 'bg-amber-600',
              chip: 'Surveillance',
              icon: Icons.Activity,
            }].map((card) => (
              <Card key={card.title} className="border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl text-white flex items-center justify-center" style={{ backgroundColor: 'transparent' }}>
                      <div className={`${card.accent} w-full h-full rounded-xl flex items-center justify-center`}>
                        <card.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <span className="text-xs font-medium bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full">{card.chip}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-600 mb-1">{card.title}</p>
                    <p className="text-3xl font-bold text-neutral-900">{isLoading ? '…' : card.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <Card className="border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Actions rapides</h2>
                  <p className="text-sm text-neutral-600">Administration centrale des écoles et comptes.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[{
                  title: 'Gérer les écoles',
                  description: 'Créer, activer, configurer',
                  icon: Icons.Building,
                  href: '/dashboard/super-admin/schools',
                }, {
                  title: 'Tous les comptes',
                  description: 'Accès, rôles, sécurité',
                  icon: Icons.Users,
                  href: '/dashboard/super-admin/accounts',
                }, {
                  title: 'Paramètres',
                  description: 'Mon profil et préférences',
                  icon: Icons.Settings,
                  href: '/dashboard/profile',
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

          {/* Users by Role & System info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Utilisateurs par rôle</h3>
                <div className="space-y-4">
                  {Object.entries({
                    ADMIN: { label: 'Administrateurs', icon: 'Users', color: 'blue' },
                    TEACHER: { label: 'Enseignants', icon: 'Student', color: 'emerald' },
                    PARENT: { label: 'Parents', icon: 'Users', color: 'purple' },
                    ACCOUNTANT: { label: 'Comptables', icon: 'DollarSign', color: 'amber' },
                    SECRETARY: { label: 'Secrétaires', icon: 'Mail', color: 'neutral' },
                    HR: { label: 'Ressources Humaines', icon: 'Users', color: 'slate' },
                  }).map(([role, config]) => {
                    const count = stats.usersByRole[role] || 0;
                    const percentage = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                    const Icon = Icons[config.icon as keyof typeof Icons];

                    return (
                      <div key={role}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`h-8 w-8 rounded-lg bg-${config.color}-100 flex items-center justify-center`}>
                              <Icon className={`h-4 w-4 text-${config.color}-700`} />
                            </div>
                            <span className="text-sm font-medium text-neutral-700">{config.label}</span>
                          </div>
                          <span className="text-sm font-semibold text-neutral-900">{count}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`bg-${config.color}-600 h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className="border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900">Informations système</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Stable</span>
                </div>
                <div className="space-y-3">
                  {[{
                    label: 'Version',
                    value: '1.0.0',
                  }, {
                    label: 'Environnement',
                    value: 'Production',
                  }, {
                    label: 'Base de données',
                    value: 'Connectée',
                  }, {
                    label: 'Stockage',
                    value: 'Disponible',
                  }].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <span className="text-sm font-medium text-neutral-600">{item.label}</span>
                      <span className="text-sm font-semibold text-neutral-900">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2">
                  <Button variant="outline" className="w-full" onClick={() => loadDashboardStats()}>
                    <Icons.Activity className="h-4 w-4 mr-2" /> Actualiser les statistiques
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Insights */}
          <Card className="border border-neutral-200 shadow-sm bg-neutral-900 text-white">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Priorités du jour</h3>
                  <p className="text-sm text-neutral-300">Gardez un œil sur les points sensibles.</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10">Synthèse</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[{
                  title: 'Activation écoles',
                  details: `${stats.activeSchools}/${stats.totalSchools} actives`,
                  icon: Icons.Check,
                }, {
                  title: 'Sécurité comptes',
                  details: 'Contrôler les rôles critiques',
                  icon: Icons.Shield,
                }, {
                  title: 'Support utilisateurs',
                  details: 'Anticiper les demandes entrantes',
                  icon: Icons.Mail,
                }].map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-neutral-300">{item.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
