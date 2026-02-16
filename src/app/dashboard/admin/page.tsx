'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface AdminStats {
  totalStudents: number;
  totalClasses: number;
  totalTeachers: number;
  currentYear: string;
  attendanceToday: {
    present: number;
    absent: number;
    late: number;
    rate: number;
  };
  recentAbsences: Array<{
    student_name: string;
    date: string;
    status: string;
    session: string;
  }>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalStudents: 0,
    totalClasses: 0,
    totalTeachers: 0,
    currentYear: '',
    attendanceToday: { present: 0, absent: 0, late: 0, rate: 0 },
    recentAbsences: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ABSENT' | 'LATE'>('ALL');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'NAME_ASC' | 'NAME_DESC'>('DATE_DESC');

  useRealtimeSubscription({ table: 'students', event: '*', onData: () => loadStats(), enabled: !!user?.school_id });
  useRealtimeSubscription({ table: 'classes', event: '*', onData: () => loadStats(), enabled: !!user?.school_id });
  useRealtimeSubscription({ table: 'attendance', event: '*', onData: () => loadStats(), enabled: !!user?.school_id });

  const loadStats = async () => {
    try {
      if (!user?.school_id) return;

      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user.school_id)
        .is('deleted_at', null);
      if (studentsError) throw studentsError;

      const { count: classesCount, error: classesError } = await supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user.school_id)
        .is('deleted_at', null);
      if (classesError) throw classesError;

      const { count: teachersCount, error: teachersError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'TEACHER')
        .eq('school_id', user.school_id);
      if (teachersError) throw teachersError;

      const { data: yearData, error: yearError } = await supabase
        .from('years')
        .select('name')
        .eq('school_id', user.school_id)
        .eq('is_current', true)
        .single();
      if (yearError && yearError.code !== 'PGRST116') throw yearError;

      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today);
      if (attendanceError && attendanceError.code !== 'PGRST116') throw attendanceError;

      const present = todayAttendance?.filter((a) => a.status === 'PRESENT').length || 0;
      const absent = todayAttendance?.filter((a) => a.status === 'ABSENT').length || 0;
      const late = todayAttendance?.filter((a) => a.status === 'LATE').length || 0;
      const total = todayAttendance?.length || 0;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      const { data: recentAbsences, error: absencesError } = await supabase
        .from('attendance')
        .select(`
          status,
          date,
          session,
          students(first_name, last_name)
        `)
        .in('status', ['ABSENT', 'LATE'])
        .order('date', { ascending: false })
        .limit(10);
      if (absencesError && absencesError.code !== 'PGRST116') throw absencesError;

      setStats({
        totalStudents: studentsCount || 0,
        totalClasses: classesCount || 0,
        totalTeachers: teachersCount || 0,
        currentYear: yearData?.name || 'N/A',
        attendanceToday: { present, absent, late, rate: attendanceRate },
        recentAbsences: (recentAbsences || []).map((a: any) => ({
          student_name: `${a.students?.first_name || ''} ${a.students?.last_name || ''}`.trim(),
          date: a.date,
          status: a.status,
          session: a.session || 'MORNING',
        })),
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user?.school_id]);

  const filteredAbsences = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = stats.recentAbsences.filter((absence) => {
      const matchesSearch = normalizedSearch
        ? absence.student_name.toLowerCase().includes(normalizedSearch)
        : true;
      const matchesStatus = statusFilter === 'ALL' ? true : absence.status === statusFilter;
      const matchesSession = sessionFilter === 'ALL' ? true : absence.session === sessionFilter;
      return matchesSearch && matchesStatus && matchesSession;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'DATE_DESC') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'DATE_ASC') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'NAME_ASC') return a.student_name.localeCompare(b.student_name, 'fr');
      return b.student_name.localeCompare(a.student_name, 'fr');
    });

    return sorted;
  }, [stats.recentAbsences, searchTerm, statusFilter, sessionFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Administratif</h1>
        <p className="text-gray-600 mt-2">
          Année scolaire: <span className="font-semibold">{stats.currentYear}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Classes</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{stats.totalClasses}</p>
              </div>
              <Icons.BookOpen className="w-12 h-12 text-green-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Enseignants</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">{stats.totalTeachers}</p>
              </div>
              <Icons.Award className="w-12 h-12 text-purple-300" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Taux Présence (Auj.)</p>
                <p className="text-3xl font-bold text-orange-900 mt-1">{stats.attendanceToday.rate}%</p>
              </div>
              <Icons.CheckCircle className="w-12 h-12 text-orange-300" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mr-4">
                <Icons.CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Présents (Aujourd'hui)</p>
                <p className="text-2xl font-bold text-green-600">{stats.attendanceToday.present}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mr-4">
                <Icons.AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Absents (Aujourd'hui)</p>
                <p className="text-2xl font-bold text-red-600">{stats.attendanceToday.absent}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center mr-4">
                <Icons.Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Retards (Aujourd'hui)</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.attendanceToday.late}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Absences Récentes</h2>
              <p className="text-sm text-gray-600">Filtre et tri sur la liste des absences/retards.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full lg:w-auto">
              <input
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                placeholder="Rechercher un élève"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="ALL">Tous les statuts</option>
                <option value="ABSENT">Absents</option>
                <option value="LATE">Retards</option>
              </select>
              <select
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value as typeof sessionFilter)}
              >
                <option value="ALL">Toutes les séances</option>
                <option value="MORNING">Matin</option>
                <option value="AFTERNOON">Après-midi</option>
              </select>
              <select
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="DATE_DESC">Plus récents</option>
                <option value="DATE_ASC">Plus anciens</option>
                <option value="NAME_ASC">Nom A → Z</option>
                <option value="NAME_DESC">Nom Z → A</option>
              </select>
            </div>
          </div>

          {filteredAbsences.length === 0 ? (
            <p className="text-gray-600 text-sm">Aucune absence enregistrée récemment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Étudiant</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Date</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Séance</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAbsences.map((absence, idx) => (
                    <tr key={`${absence.student_name}-${absence.date}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{absence.student_name}</td>
                      <td className="px-4 py-2">{new Date(absence.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          {absence.session === 'MORNING' ? 'Matin' : 'Après-midi'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            absence.status === 'ABSENT'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {absence.status === 'ABSENT' ? 'Absent' : 'Retard'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
