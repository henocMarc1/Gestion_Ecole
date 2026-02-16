'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface SecretaryStats {
  totalStudents: number;
  certificates: { pending: number; issued: number };
  documents: number;
  finance: {
    unpaidRate: number;
    paymentsLast30Days: number;
    totalRevenue30Days: number;
  };
  classes: {
    overloaded: number;
    total: number;
  };
  topAbsences: Array<{
    className: string;
    absenceCount: number;
    studentCount: number;
  }>;
}

export default function SecretaryDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SecretaryStats>({
    totalStudents: 0,
    certificates: { pending: 0, issued: 0 },
    documents: 0,
    finance: { unpaidRate: 0, paymentsLast30Days: 0, totalRevenue30Days: 0 },
    classes: { overloaded: 0, total: 0 },
    topAbsences: [],
  });

  useRealtimeSubscription({
    table: 'students',
    event: '*',
    onData: () => loadStats(),
    enabled: !!user?.school_id,
  });

  useRealtimeSubscription({
    table: 'certificates',
    event: '*',
    onData: () => loadStats(),
    enabled: !!user?.school_id,
  });

  const loadStats = async () => {
    try {
      if (!user?.school_id) return;

      const studentsResponse = await supabase
        .from('students')
        .select('id, class_id', { count: 'exact' })
        .eq('school_id', user.school_id)
        .is('deleted_at', null);
      if (studentsResponse.error) throw studentsResponse.error;
      const studentsCount = studentsResponse.count || 0;
      const studentsData = studentsResponse.data || [];

      const certsResponse = await supabase
        .from('certificates')
        .select('status')
        .eq('school_id', user.school_id);
      if (certsResponse.error && certsResponse.error.code !== 'PGRST116') throw certsResponse.error;

      const certsData = certsResponse.data;

      const certsPending = certsData?.filter((c) => c.status === 'PENDING').length || 0;
      const certsIssued = certsData?.filter((c) => c.status === 'ISSUED').length || 0;

      // Finance KPIs - frais de scolarite
      const { data: tuitionFeesData } = await supabase
        .from('tuition_fees')
        .select('class_id, total_amount, registration_fee, other_fees, academic_year')
        .eq('school_id', user.school_id)
        .order('academic_year', { ascending: false });

      const classCounts = new Map<string, number>();
      studentsData.forEach((student) => {
        if (!student.class_id) return;
        classCounts.set(student.class_id, (classCounts.get(student.class_id) || 0) + 1);
      });

      type TuitionFee = {
        class_id: string;
        total_amount: number;
        registration_fee: number;
        other_fees: number;
        academic_year: string;
      };

      const latestFeeByClass = new Map<string, TuitionFee>();
      (tuitionFeesData || []).forEach((fee) => {
        if (!latestFeeByClass.has(fee.class_id)) {
          latestFeeByClass.set(fee.class_id, fee);
        }
      });

      let totalDue = 0;
      latestFeeByClass.forEach((fee, classId) => {
        const count = classCounts.get(classId) || 0;
        const classTotal =
          (Number(fee.total_amount) || 0) +
          (Number(fee.registration_fee) || 0) +
          (Number(fee.other_fees) || 0);
        totalDue += classTotal * count;
      });

      const { data: tuitionPaymentsAll } = await supabase
        .from('tuition_payments')
        .select('amount')
        .eq('school_id', user.school_id);

      const totalPaid = (tuitionPaymentsAll || []).reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0
      );

      const unpaidRate = totalDue > 0
        ? Math.round(((totalDue - totalPaid) / totalDue) * 100)
        : 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recentTuitionPayments } = await supabase
        .from('tuition_payments')
        .select('amount')
        .eq('school_id', user.school_id)
        .gte('payment_date', thirtyDaysAgo.toISOString().split('T')[0]);
      const paymentsLast30Days = recentTuitionPayments?.length || 0;
      const totalRevenue30Days = recentTuitionPayments?.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      ) || 0;

      // Classes surcharge
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name, capacity')
        .eq('school_id', user.school_id)
        .is('deleted_at', null);

      let overloadedCount = 0;
      if (classesData) {
        for (const cls of classesData) {
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .is('deleted_at', null);
          if (count && cls.capacity && count > cls.capacity) {
            overloadedCount++;
          }
        }
      }

      // Top absences par classe
      const { data: absencesData } = await supabase
        .from('attendance')
        .select('student_id, students!inner(class_id, classes(name))')
        .in('status', ['ABSENT', 'LATE']);

      const absencesByClass: Record<string, { name: string; count: number }> = {};
      absencesData?.forEach((a: any) => {
        const className = a.students?.classes?.name || 'Non assigné';
        if (!absencesByClass[className]) {
          absencesByClass[className] = { name: className, count: 0 };
        }
        absencesByClass[className].count++;
      });

      const topAbsences = Object.values(absencesByClass)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item) => ({
          className: item.name,
          absenceCount: item.count,
          studentCount: 0,
        }));

      setStats({
        totalStudents: studentsCount,
        certificates: { pending: certsPending, issued: certsIssued },
        documents: 0,
        finance: { unpaidRate, paymentsLast30Days, totalRevenue30Days },
        classes: { overloaded: overloadedCount, total: classesData?.length || 0 },
        topAbsences,
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user?.school_id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  type ActionColor = keyof typeof colorClasses;
  type ActionItem = {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    href: string;
    color: ActionColor;
  };

  const actions: ActionItem[] = [
    {
      title: 'Gestion des Certificats',
      description: 'Demandes et émission de certificats',
      icon: Icons.FileText,
      href: '/dashboard/secretary/certificates',
      color: 'blue',
    },
    {
      title: 'Registro des Étudiants',
      description: 'Inscrire de nouveaux étudiants',
      icon: Icons.Users,
      href: '/dashboard/secretary/register-student',
      color: 'green',
    },
    {
      title: 'Liste des Étudiants',
      description: 'Consulter tous les étudiants',
      icon: Icons.BookOpen,
      href: '/dashboard/secretary/students',
      color: 'purple',
    },
    {
      title: 'Documents',
      description: 'Gestion des documents officiels',
      icon: Icons.FileText,
      href: '/dashboard/secretary/documents',
      color: 'orange',
    },
  ];

  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    green: 'from-green-50 to-green-100 border-green-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
    orange: 'from-orange-50 to-orange-100 border-orange-200',
  } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Secrétariat</h1>
        <p className="text-gray-600 mt-2">Gestion administrative et documents de l'école</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Étudiants</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{stats.totalStudents}</p>
              </div>
              <Icons.Users className="w-12 h-12 text-blue-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Certificats (En attente)</p>
                <p className="text-3xl font-bold text-yellow-900 mt-1">{stats.certificates.pending}</p>
              </div>
              <Icons.Clock className="w-12 h-12 text-yellow-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Certificats (Émis)</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{stats.certificates.issued}</p>
              </div>
              <Icons.CheckCircle className="w-12 h-12 text-green-300" />
            </div>
          </div>
        </Card>
      </div>

      {/* KPI Finance & Qualité */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Indicateurs Finance & Qualité</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Taux d'impayés</p>
                <Icons.AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-700">{stats.finance.unpaidRate}%</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Paiements (30j)</p>
                <Icons.CreditCard className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-700">{stats.finance.paymentsLast30Days}</p>
              <p className="text-xs text-gray-600 mt-1">{stats.finance.totalRevenue30Days.toLocaleString('fr-FR')} F</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Classes surchargées</p>
                <Icons.AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-orange-700">
                {stats.classes.overloaded}/{stats.classes.total}
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Top absences</p>
                <Icons.BarChart className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {stats.topAbsences.length > 0 ? stats.topAbsences[0].absenceCount : 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {stats.topAbsences.length > 0 ? stats.topAbsences[0].className : '-'}
              </p>
            </div>
          </div>

          {stats.topAbsences.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Top 5 classes avec absences/retards</h3>
              <div className="space-y-2">
                {stats.topAbsences.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{item.className}</span>
                    <span className="text-sm font-bold text-red-600">{item.absenceCount} absences</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((action) => (
          <Card
            key={action.href}
            className={`bg-gradient-to-br ${colorClasses[action.color]} border-2 cursor-pointer hover:shadow-lg transition-all`}
            onClick={() => router.push(action.href)}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{action.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{action.description}</p>
                </div>
                <action.icon className="w-8 h-8 text-gray-400 ml-4" />
              </div>
              <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                Accéder <Icons.ChevronRight className="w-4 h-4 ml-2" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-6 bg-blue-50 border-l-4 border-blue-500">
          <h3 className="font-semibold text-gray-900 mb-3">Rappels rapides</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <Icons.CheckCircle className="w-4 h-4 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Traiter les demandes de certificats en attente</span>
            </li>
            <li className="flex items-start">
              <Icons.CheckCircle className="w-4 h-4 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Maintenir à jour la liste des étudiants</span>
            </li>
            <li className="flex items-start">
              <Icons.CheckCircle className="w-4 h-4 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Archiver les documents officiels en sécurité</span>
            </li>
            <li className="flex items-start">
              <Icons.CheckCircle className="w-4 h-4 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <span>Vérifier les demandes d'inscription nouveau</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
