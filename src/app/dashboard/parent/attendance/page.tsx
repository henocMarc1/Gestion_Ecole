'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  session?: 'MORNING' | 'AFTERNOON';
  student?: { first_name: string; last_name: string };
  class?: { name: string; level: string };
}

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string;
  class_level?: string;
}

const MONTH_NAMES = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

export default function ParentAttendancePage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      loadAttendance();
    }
  }, [selectedChild, selectedMonth, selectedYear]);

  // Abonnement aux changements des enfants
  useRealtimeSubscription({
    table: 'parents_students',
    event: '*',
    filter: `parent_id=eq.${user?.id}`,
    onData: () => {
      loadChildren();
    },
    enabled: !!user?.id,
  });

  // Abonnement aux changements des présences
  useRealtimeSubscription({
    table: 'attendance',
    event: '*',
    filter: selectedChild ? `student_id=eq.${selectedChild}` : undefined,
    onData: () => {
      if (selectedChild) {
        loadAttendance();
      }
    },
    enabled: !!selectedChild,
  });

  const loadChildren = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('parents_students')
        .select(`
          student_id,
          students(
            id,
            first_name,
            last_name,
            classes(name, level)
          )
        `)
        .eq('parent_id', user.id);

      if (error) throw error;

      const childrenList = (data || []).map((ps: any) => ({
        id: ps.students.id,
        first_name: ps.students.first_name,
        last_name: ps.students.last_name,
        class_name: ps.students.classes?.name || 'N/A',
        class_level: ps.students.classes?.level || '',
      }));

      setChildren(childrenList);
      if (childrenList.length > 0 && !selectedChild) {
        setSelectedChild(childrenList[0].id);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des enfants');
    }
  };

  const loadAttendance = async () => {
    try {
      setIsLoading(true);
      if (!selectedChild) return;
      // Calcul des bornes de dates au format AAAA-MM-JJ pour éviter les décalages de fuseau (UTC)
      const startDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const endDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(new Date(selectedYear, selectedMonth + 1, 0).getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', selectedChild)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date');

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des présences');
    } finally {
      setIsLoading(false);
    }
  };

  const currentChild = children.find(c => c.id === selectedChild);

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED').length,
    absent: attendance.filter(a => a.status === 'ABSENT').length,
    percentage: attendance.length > 0
      ? Math.round((attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EXCUSED').length / attendance.length) * 100)
      : 0,
  };

  const monthStart = new Date(selectedYear, selectedMonth, 1);
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
  const daysInMonth = monthEnd.getDate();
  // getDay() retourne 0=dimanche, on doit convertir en 0=lundi pour notre calendrier
  let firstDayOfWeek = monthStart.getDay();
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // 0=lundi, 6=dimanche

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Présences et absences</h1>
        <p className="text-gray-600">Suivi des présences de vos enfants à l'école</p>
      </div>

      {/* Sélection enfant */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <Icons.Student className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner un enfant
            </label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choisir un enfant</option>
              {children.map(child => (
                <option key={child.id} value={child.id}>
                  {child.first_name} {child.last_name} - {child.class_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {selectedChild && currentChild && (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">{stats.percentage}%</div>
                <p className="text-sm text-gray-600 mt-1">Taux de présence</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.present}</div>
                <p className="text-sm text-gray-600 mt-1">Présent(e)s</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{stats.absent}</div>
                <p className="text-sm text-gray-600 mt-1">Absent(e)s</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{stats.total}</div>
                <p className="text-sm text-gray-600 mt-1">Jours total</p>
              </div>
            </Card>
          </div>

          {/* Calendrier */}
          <Card>
            <div className="space-y-4">
              {/* Sélection mois/année */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedMonth === 0) {
                        setSelectedMonth(11);
                        setSelectedYear(selectedYear - 1);
                      } else {
                        setSelectedMonth(selectedMonth - 1);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Icons.ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-semibold">
                    {MONTH_NAMES[selectedMonth]} {selectedYear}
                  </span>
                  <button
                    onClick={() => {
                      if (selectedMonth === 11) {
                        setSelectedMonth(0);
                        setSelectedYear(selectedYear + 1);
                      } else {
                        setSelectedMonth(selectedMonth + 1);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Icons.ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Calendrier */}
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                  <div key={`day-header-${idx}`} className="text-center font-semibold text-sm text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                {days.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="h-20" />;
                  }

                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const daySessions = attendance.filter(a => a.date === dateStr);
                  const morningSession = daySessions.find((a: any) => a.session === 'MORNING');
                  const afternoonSession = daySessions.find((a: any) => a.session === 'AFTERNOON');
                  
                  const isWeekend = (firstDayOfWeek + day - 1) % 7 >= 5;
                  const isWednesday = (firstDayOfWeek + day - 1) % 7 === 2; // 2 = mercredi (0=lundi)

                  // Couleurs pour matin et après-midi
                  let morningColor = 'bg-white';
                  let afternoonColor = 'bg-white';
                  
                  if (isWeekend || isWednesday) {
                    morningColor = 'bg-gray-50';
                    afternoonColor = 'bg-gray-50';
                  } else {
                    // Matin : vert si présent, rouge si absent/retard/excusé, blanc si pas de donnée
                    if (morningSession) {
                      morningColor = morningSession.status === 'PRESENT' ? 'bg-green-100' : 'bg-red-100';
                    }
                    // Après-midi : vert si présent, rouge si absent/retard/excusé, blanc si pas de donnée
                    if (afternoonSession) {
                      afternoonColor = afternoonSession.status === 'PRESENT' ? 'bg-green-100' : 'bg-red-100';
                    }
                  }
                  
                  const morning = morningSession ? morningSession.status === 'PRESENT' : undefined;
                  const afternoon = afternoonSession ? afternoonSession.status === 'PRESENT' : undefined;

                  return (
                    <div
                      key={`day-${day}`}
                      className="h-20 flex flex-col rounded-lg border-2 border-gray-300 overflow-hidden relative group"
                    >
                      {/* Moitié haute - Matin */}
                      <div className={`h-10 ${morningColor} flex items-center justify-center border-b-2 border-gray-400`}>
                        <span className={`font-semibold text-sm ${isWednesday ? 'text-gray-400' : ''}`}>{day}</span>
                      </div>
                      {/* Moitié basse - Après-midi */}
                      <div className={`h-10 ${afternoonColor}`}></div>
                      
                      {daySessions.length > 0 && (
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {`Matin: ${morning === undefined ? '—' : (morning ? 'Présent' : 'Absent')} | Après-midi: ${afternoon === undefined ? '—' : (afternoon ? 'Présent' : 'Absent')}`}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>

              {/* Légende */}
              <div className="flex gap-4 mt-4 pt-4 border-t flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-200 rounded" />
                  <span className="text-sm text-gray-600">Présent (matin & après-midi)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-200 rounded" />
                  <span className="text-sm text-gray-600">Absent (au moins une séance)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded" />
                  <span className="text-sm text-gray-600">Weekend & Mercredi (pas de cours)</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Résumé du mois */}
          {attendance.length === 0 && (
            <Card>
              <div className="text-center py-8">
                <Icons.Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucune donnée de présence pour ce mois</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
