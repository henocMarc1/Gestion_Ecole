'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  class?: { name: string };
}

export default function MyStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'class'>('name-asc');

  useEffect(() => {
    loadStudents();
  }, [user]);

  useEffect(() => {
    filterStudents();
  }, [searchTerm, students, classFilter, sortBy]);

  // Abonnement aux changements des élèves
  useRealtimeSubscription({
    table: 'students',
    event: '*',
    onData: () => {
      loadStudents();
    },
    enabled: !!user?.id,
  });

  // Abonnement aux changements des assignments prof-classe
  useRealtimeSubscription({
    table: 'teacher_classes',
    event: '*',
    filter: `teacher_id=eq.${user?.id}`,
    onData: () => {
      loadStudents();
    },
    enabled: !!user?.id,
  });

  const loadStudents = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data: classesData, error: classesError } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', user.id);

      if (classesError) throw classesError;

      const classIds = (classesData || []).map(tc => tc.class_id);

      if (classIds.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*, class:classes(name)')
        .in('class_id', classIds)
        .is('deleted_at', null)
        .order('last_name');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterStudents = () => {
    const term = searchTerm.toLowerCase();
    let filtered = students.filter(s => {
      const matchesSearch = s.first_name.toLowerCase().includes(term) ||
        s.last_name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term);
      const matchesClass = classFilter === 'ALL' || s.class?.name === classFilter;
      return matchesSearch && matchesClass;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'name-asc':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'fr-FR');
        case 'name-desc':
          return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`, 'fr-FR');
        case 'class':
          return (a.class?.name || '').localeCompare(b.class?.name || '', 'fr-FR');
        default:
          return 0;
      }
    });

    setFilteredStudents(filtered);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Mes élèves</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Total: {filteredStudents.length} élève{filteredStudents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtres et Recherche */}
      {students.length > 0 && (
        <Card className="border border-neutral-200 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Chercher par nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Toutes les classes</option>
              {Array.from(new Set(students.map(s => s.class?.name).filter(Boolean))).sort().map(className => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="name-asc">Nom (A → Z)</option>
              <option value="name-desc">Nom (Z → A)</option>
              <option value="class">Par classe</option>
            </select>
          </div>
        </Card>
      )}

      {/* Liste */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        </Card>
      ) : students.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Student className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun élève</h3>
          <p className="text-sm text-neutral-600">Vous n'avez pas encore d'élèves assignés</p>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Filter className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">Aucun résultat</h3>
          <p className="text-sm text-neutral-600">Vérifiez vos critères de recherche</p>
        </Card>
      ) : (
        <Card className="border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Nom complet</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">
                        {student.first_name} {student.last_name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{student.email || '-'}</td>
                    <td className="px-4 py-3 text-sm">{student.class?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => window.location.href = `/dashboard/teacher/students/${student.id}`}
                        className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        Détails
                      </button>
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
