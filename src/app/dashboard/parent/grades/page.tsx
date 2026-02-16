'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface Grade {
  id: string;
  subject: string;
  grade: number;
  max_grade: number;
  date: string;
  teacher_name?: string;
  term?: string;
}

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string;
  class_level?: string;
}

interface Bulletin {
  id: string;
  term: string;
  average: number;
  remarks: string;
  issued_date: string;
}

export default function ParentGradesPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'grades' | 'bulletins'>('grades');

  useEffect(() => {
    loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      loadGrades();
      loadBulletins();
    }
  }, [selectedChild]);

  // Abonnement aux changements des notes
  useRealtimeSubscription({
    table: 'grades',
    event: '*',
    onData: () => {
      if (selectedChild) {
        loadGrades();
      }
    },
    enabled: !!selectedChild,
  });

  // Abonnement aux changements des bulletins
  useRealtimeSubscription({
    table: 'bulletins',
    event: '*',
    onData: () => {
      if (selectedChild) {
        loadBulletins();
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

  const loadGrades = async () => {
    try {
      setIsLoading(true);
      if (!selectedChild) return;

      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .eq('student_id', selectedChild)
        .order('date', { ascending: false });

      if (error) throw error;
      setGrades(data || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des notes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBulletins = async () => {
    try {
      if (!selectedChild) return;

      const { data, error } = await supabase
        .from('bulletins')
        .select('*')
        .eq('student_id', selectedChild)
        .order('issued_date', { ascending: false });

      if (error) throw error;
      setBulletins(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const currentChild = children.find(c => c.id === selectedChild);

  const groupedGrades = grades.reduce((acc: { [key: string]: Grade[] }, grade) => {
    const month = new Date(grade.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(grade);
    return acc;
  }, {});

  const average = grades.length > 0
    ? (grades.reduce((sum, g) => sum + (g.grade / g.max_grade) * 20, 0) / grades.length).toFixed(2)
    : 0;

  const getGradeColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBackground = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-50';
    if (percentage >= 60) return 'bg-yellow-50';
    if (percentage >= 40) return 'bg-orange-50';
    return 'bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notes et bulletins</h1>
        <p className="text-gray-600">Suivi académique de vos enfants</p>
      </div>

      {/* Sélection enfant */}
      <Card>
        <div className="flex items-center gap-4">
          <Icons.Student className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner un enfant
            </label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
          {/* Onglets */}
          <div className="flex gap-4 border-b">
            <button
              onClick={() => setActiveTab('grades')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'grades'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              <Icons.FileText className="w-5 h-5 inline mr-2" />
              Notes
            </button>
            <button
              onClick={() => setActiveTab('bulletins')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'bulletins'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              <Icons.Award className="w-5 h-5 inline mr-2" />
              Bulletins
            </button>
          </div>

          {/* Onglet Notes */}
          {activeTab === 'grades' && (
            <div className="space-y-6">
              {/* Moyenne générale */}
              {grades.length > 0 && (
                <Card className="bg-gradient-to-r from-primary-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Moyenne générale</p>
                      <p className={`text-4xl font-bold ${getGradeColor((Number(average) / 20) * 100)}`}>
                        {average}/20
                      </p>
                    </div>
                    <Icons.TrendingUp className="w-12 h-12 text-primary-200" />
                  </div>
                </Card>
              )}

              {/* Groupes par mois */}
              {Object.entries(groupedGrades).map(([month, monthGrades]) => (
                <div key={month}>
                  <h3 className="font-semibold text-gray-900 mb-3 text-lg">{month}</h3>
                  <div className="space-y-3">
                    {monthGrades.map(grade => {
                      const percentage = (grade.grade / grade.max_grade) * 100;
                      const noteOn20 = (grade.grade / grade.max_grade) * 20;

                      return (
                        <Card
                          key={grade.id}
                          className={`${getGradeBackground(percentage)} border-l-4 border-current`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{grade.subject}</p>
                              <p className="text-sm text-gray-600 mt-1">
                                {new Date(grade.date).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${getGradeColor(percentage)}`}>
                                {noteOn20.toFixed(1)}/20
                              </p>
                              <p className="text-sm text-gray-600">
                                ({grade.grade}/{grade.max_grade})
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}

              {grades.length === 0 && (
                <Card>
                  <div className="text-center py-8">
                    <Icons.FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Aucune note pour le moment</p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Onglet Bulletins */}
          {activeTab === 'bulletins' && (
            <div className="space-y-4">
              {bulletins.length > 0 ? (
                bulletins.map(bulletin => (
                  <Card key={bulletin.id} className="border-l-4 border-primary-500">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">
                          Bulletin - {bulletin.term}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Émis le {new Date(bulletin.issued_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary-600">{bulletin.average.toFixed(2)}/20</p>
                        <p className="text-sm text-gray-600">Moyenne</p>
                      </div>
                    </div>
                    {bulletin.remarks && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium text-gray-700 mb-2">Remarques :</p>
                        <p className="text-sm text-gray-600">{bulletin.remarks}</p>
                      </div>
                    )}
                  </Card>
                ))
              ) : (
                <Card>
                  <div className="text-center py-8">
                    <Icons.Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Aucun bulletin disponible</p>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
