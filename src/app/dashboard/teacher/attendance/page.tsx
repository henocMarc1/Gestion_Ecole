'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  session?: 'MORNING' | 'AFTERNOON';
  created_at: string;
  student?: { first_name: string; last_name: string };
  class?: { name: string };
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc'>('name-asc');;

  useEffect(() => {
    loadClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadStudentsAndAttendance();
    }
  }, [selectedClass, selectedDate, selectedSession]);

  // Abonnement aux changements des présences
  useRealtimeSubscription({
    table: 'attendance',
    event: '*',
    filter: `class_id=eq.${selectedClass},date=eq.${selectedDate},session=eq.${selectedSession}`,
    onData: () => {
      loadStudentsAndAttendance();
    },
    enabled: !!selectedClass,
  });

  // Abonnement aux changements des élèves
  useRealtimeSubscription({
    table: 'students',
    event: '*',
    onData: () => {
      if (selectedClass) {
        loadStudentsAndAttendance();
      }
    },
    enabled: !!selectedClass,
  });

  const loadClasses = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('teacher_classes')
        .select('class:classes(id, name, deleted_at)')
        .eq('teacher_id', user.id);

      if (error) throw error;
      // Filter out deleted classes
      const activeClasses = (data || [])
        .map(tc => tc.class)
        .filter(Boolean)
        .filter((cls: any) => !cls.deleted_at);
      setClasses(activeClasses);
    } catch (error) {
      toast.error('Erreur lors du chargement des classes');
      console.error(error);
    }
  };

  const loadStudentsAndAttendance = async () => {
    setIsLoading(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('class_id', selectedClass)
          .is('deleted_at', null)
          .order('last_name', { ascending: true })
          .order('first_name', { ascending: true }),
        supabase
          .from('attendance')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('date', selectedDate)
          .eq('session', selectedSession),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      const studentList = studentsRes.data || [];
      const attendanceList = attendanceRes.data || [];

      setStudents(studentList);
      setAttendance(attendanceList);

      // Pré-remplir les enregistrements existants
      const recordsMap: Record<string, 'PRESENT' | 'ABSENT'> = {};
      
      // Initialiser tous les élèves avec 'ABSENT' par défaut
      studentList.forEach(s => {
        recordsMap[s.id] = 'ABSENT';
      });
      
      // Appliquer les statuts existants
      attendanceList.forEach(a => {
        recordsMap[a.student_id] = a.status || 'PRESENT';
      });
      setRecords(recordsMap);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAttendance = (studentId: string) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT',
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      toast.error('Sélectionnez une classe');
      return;
    }

    setIsSaving(true);
    try {
      // Récupérer les IDs existants
      const existingIds = attendance.map(a => a.student_id);

      // Insérer les nouveaux enregistrements
      const today = new Date().toISOString().split('T')[0];
      const isToday = selectedDate === today;
      const toInsert = students
        .filter(s => !existingIds.includes(s.id))
        .map(s => {
          const base: any = {
            class_id: selectedClass,
            student_id: s.id,
            session: selectedSession,
            status: records[s.id],
          };
          // Si la date sélectionnée est aujourd'hui, laisser la DB utiliser DEFAULT CURRENT_DATE
          if (!isToday) {
            base.date = selectedDate;
          }
          return base;
        });

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('attendance')
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      // Mettre à jour les enregistrements existants
      for (const record of attendance) {
        if (records[record.student_id] !== record.status) {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({ status: records[record.student_id] })
            .eq('id', record.id);
          if (updateError) throw updateError;
        }
      }

      toast.success('Présence sauvegardée');
      loadStudentsAndAttendance();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length;

  // Filter and sort students
  const displayedStudents = students
    .filter(s => {
      const matchesSearch = searchTerm === '' || 
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || records[s.id] === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const fullNameA = `${a.first_name} ${a.last_name}`;
      const fullNameB = `${b.first_name} ${b.last_name}`;
      
      if (sortBy === 'name-asc') {
        return fullNameA.localeCompare(fullNameB, 'fr-FR');
      } else {
        return fullNameB.localeCompare(fullNameA, 'fr-FR');
      }
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Marquage de présence</h1>
        <p className="text-sm text-neutral-600 mt-1">Enregistrez la présence des élèves</p>
      </div>

      {/* Filtres */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Classe</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Séance</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value as 'MORNING' | 'AFTERNOON')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="MORNING">Matin</option>
              <option value="AFTERNOON">Après-midi</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const selected = new Date(e.target.value);
                const dayOfWeek = selected.getDay(); // 0=dimanche, 3=mercredi, 6=samedi
                
                // Bloquer dimanche (0), mercredi (3) et samedi (6)
                if (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 6) {
                  toast.error('Pas de cours dimanche, mercredi et samedi');
                  return;
                }
                setSelectedDate(e.target.value);
              }}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Jours de cours: Lun, Mar, Jeu, Ven</p>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSaveAttendance} disabled={isSaving || !selectedClass} className="w-full">
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Statistiques */}
      {selectedClass && (
        <Card className="border border-neutral-200 p-4">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-neutral-600">Présents</p>
              <p className="text-2xl font-bold text-success-600">{presentCount}/{students.length}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-600">Taux de présence</p>
              <p className="text-2xl font-bold text-primary-600">
                {students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filtres et Recherche */}
      {selectedClass && !isLoading && students.length > 0 && (
        <Card className="border border-neutral-200 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Chercher un élève..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="PRESENT">Présents</option>
              <option value="ABSENT">Absents</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="name-asc">Nom (A → Z)</option>
              <option value="name-desc">Nom (Z → A)</option>
            </select>
          </div>
        </Card>
      )}

      {/* Liste des élèves */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : !selectedClass ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.CheckSquare className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Sélectionnez une classe</h3>
        </Card>
      ) : students.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Student className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun élève dans cette classe</h3>
        </Card>
      ) : displayedStudents.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Search className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun résultat</h3>
          <p className="text-sm text-neutral-600">Vérifiez vos critères de recherche</p>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-neutral-200">
            {displayedStudents.map((student) => (
              <div key={student.id} className="p-4 flex items-center justify-between hover:bg-neutral-50">
                <div>
                  <p className="font-medium text-neutral-900">
                    {student.first_name} {student.last_name}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleAttendance(student.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    records[student.id] === 'PRESENT'
                      ? 'bg-success-100 text-success-700 hover:bg-success-200'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {records[student.id] === 'PRESENT' ? 'Présent' : 'Absent'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
