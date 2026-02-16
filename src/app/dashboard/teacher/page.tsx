'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/helpers';

interface Stats {
  total_students: number;
  total_classes: number;
  total_teachers: number;
  attendance_rate: number;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    total_students: 0,
    total_classes: 0,
    total_teachers: 0,
    attendance_rate: 0,
  });
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  async function loadDashboardData() {
    if (!user) return;

    try {
      // Charger les classes de l'enseignant
      const { data: classes } = await supabase
        .from('teacher_classes')
        .select(`
          *,
          class:classes (
            id,
            name,
            level,
            capacity,
            students:students (count)
          )
        `)
        .eq('teacher_id', user.id);

      if (classes) {
        setMyClasses(classes);
        
        // Calculer les stats
        const totalStudents = classes.reduce((sum, tc) => {
          return sum + (tc.class?.students?.[0]?.count || 0);
        }, 0);

        setStats({
          total_students: totalStudents,
          total_classes: classes.length,
          total_teachers: 1,
          attendance_rate: 95, // À calculer réellement
        });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-emerald-50">
      <div className="relative overflow-hidden pb-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(52,211,153,0.16),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.14),transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Enseignant</span>
              <h1 className="text-3xl font-semibold text-neutral-900">Bonjour, {user?.full_name}</h1>
              <p className="text-sm text-neutral-600 max-w-2xl">Vos classes, présences et messages en un seul endroit.</p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Calendar className="w-3.5 h-3.5 text-neutral-700" /> {new Date().toLocaleDateString('fr-FR')}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Users className="w-3.5 h-3.5 text-neutral-700" /> {stats.total_students} élèves
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-neutral-200">
                  <Icons.Activity className="w-3.5 h-3.5 text-emerald-600" /> {stats.attendance_rate}% présences estimées
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[{ label: 'Mes classes', value: stats.total_classes, icon: Icons.Users, accent: 'bg-emerald-600' }, { label: 'Total élèves', value: stats.total_students, icon: Icons.Student, accent: 'bg-blue-600' }, { label: 'Taux de présence', value: `${stats.attendance_rate}%`, icon: Icons.Calendar, accent: 'bg-indigo-600' }, { label: 'Messages', value: '12', icon: Icons.Mail, accent: 'bg-neutral-900' }].map((item) => (
            <Card key={item.label} className="p-6 border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-600 text-sm">{item.label}</p>
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

        {/* Quick actions */}
        <Card className="border border-neutral-200 shadow-sm bg-white/90 backdrop-blur">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Actions rapides</h2>
                <p className="text-sm text-neutral-600">Accès direct aux tâches du jour.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[{
                title: 'Présences',
                description: 'Marquer les élèves en classe',
                icon: Icons.Check,
                href: '/dashboard/teacher/attendance',
              }, {
                title: 'Liste élèves',
                description: 'Consulter les fiches et contacts',
                icon: Icons.Users,
                href: '/dashboard/teacher/students',
              }, {
                title: 'Messages',
                description: 'Informer les parents ou la direction',
                icon: Icons.Mail,
                href: '/dashboard/teacher/messages',
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

        <Card className="border border-neutral-200 shadow-sm">
          <CardHeader title="Mes classes" description="Liste des classes assignées" />
          <div className="divide-y divide-neutral-200">
            {myClasses.map((tc) => (
              <div key={tc.id} className="p-4 hover:bg-neutral-50 transition-base">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{tc.class?.name}</h3>
                    <p className="text-sm text-neutral-600">
                      {tc.class?.level} • {tc.class?.students?.[0]?.count || 0} élèves
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/teacher/students?classId=${tc.class_id}`)}
                      className="btn-ghost btn-base px-3 py-1.5 text-xs"
                    >
                      Voir la liste
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/teacher/attendance?classId=${tc.class_id}`)}
                      className="btn-primary btn-base px-3 py-1.5 text-xs"
                    >
                      Marquer présence
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-neutral-200 shadow-sm bg-neutral-900 text-white">
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Focus du jour</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10">Prioritaire</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <p className="font-semibold">Présences</p>
                <p className="text-neutral-300">Mettre à jour les présences pour éviter les oublis.</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold">Rattrapages</p>
                <p className="text-neutral-300">Planifier les cours à rattraper cette semaine.</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold">Communication</p>
                <p className="text-neutral-300">Envoyer une note rapide aux parents si nécessaire.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
