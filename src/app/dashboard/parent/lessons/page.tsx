'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { BookOpen, Calendar, FileText, User, Download } from 'lucide-react';
import { formatDate } from '@/utils/helpers';

interface Child {
  id: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    matricule: string;
    class: {
      id: string;
      name: string;
      level: string;
    };
  };
}

interface Lesson {
  id: string;
  title: string;
  subject: string;
  description: string;
  lesson_date: string;
  duration: number;
  teacher: {
    first_name: string;
    last_name: string;
  };
  homework?: string;
  resources?: Array<{
    title: string;
    url: string;
    type: string;
  }>;
}

export default function ParentLessonsPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  useEffect(() => {
    loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      loadLessons();
    }
  }, [selectedChild]);

  const loadChildren = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('parents_students')
        .select(`
          id,
          student:students (
            id,
            first_name,
            last_name,
            matricule,
            class:classes (
              id,
              name,
              level
            )
          )
        `)
        .eq('parent_id', user.id);

      if (error) throw error;

      const transformedData = (data || []).map((item: any) => ({
        id: item.id,
        student: {
          id: item.student[0]?.id,
          first_name: item.student[0]?.first_name,
          last_name: item.student[0]?.last_name,
          matricule: item.student[0]?.matricule,
          class: {
            id: item.student[0]?.class[0]?.id,
            name: item.student[0]?.class[0]?.name,
            level: item.student[0]?.class[0]?.level,
          },
        },
      }));

      setChildren(transformedData);
      if (transformedData && transformedData.length > 0) {
        setSelectedChild(transformedData[0].student.id);
      }
    } catch (error: any) {
      console.error('Error loading children:', error);
      toast.error('Erreur lors du chargement des enfants');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLessons = async () => {
    try {
      setIsLoading(true);
      
      // Trouver la classe de l'enfant sélectionné
      const child = children.find(c => c.student.id === selectedChild);
      if (!child) return;

      const { data, error } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          subject,
          description,
          lesson_date,
          duration,
          homework,
          resources,
          teacher:users!teacher_id (
            first_name,
            last_name
          )
        `)
        .eq('class_id', child.student.class.id)
        .order('lesson_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      const transformedLessons = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        subject: item.subject,
        description: item.description,
        lesson_date: item.lesson_date,
        duration: item.duration,
        homework: item.homework,
        resources: item.resources,
        teacher: {
          first_name: item.teacher[0]?.first_name,
          last_name: item.teacher[0]?.last_name,
        },
      }));

      setLessons(transformedLessons);
    } catch (error: any) {
      console.error('Error loading lessons:', error);
      toast.error('Erreur lors du chargement des cours');
    } finally {
      setIsLoading(false);
    }
  };

  // Obtenir la liste des matières uniques
  const subjects = Array.from(new Set(lessons.map(l => l.subject))).sort();

  // Filtrer les cours par matière
  const filteredLessons = selectedSubject === 'all'
    ? lessons
    : lessons.filter(l => l.subject === selectedSubject);

  const selectedChildData = children.find(c => c.student.id === selectedChild);

  if (isLoading && children.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun enfant trouvé</h3>
          <p className="text-gray-600">Vous n'avez pas d'enfant enregistré dans le système.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-8 h-8" />
          Cahier de texte
        </h1>
        <p className="text-gray-600 mt-1">Consultez les cours et devoirs de vos enfants</p>
      </div>

      {/* Sélection de l'enfant */}
      <Card className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner un enfant
            </label>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              {children.map((child) => (
                <option key={child.student.id} value={child.student.id}>
                  {child.student.first_name} {child.student.last_name} - {child.student.class.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par matière
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="all">Toutes les matières</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedChildData && (
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{selectedChildData.student.first_name} {selectedChildData.student.last_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Classe: {selectedChildData.student.class.name}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Liste des cours */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des cours...</p>
        </div>
      ) : filteredLessons.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun cours trouvé</h3>
          <p className="text-gray-600">
            {selectedSubject === 'all'
              ? 'Aucun cours n\'a été enregistré pour cette classe.'
              : `Aucun cours de ${selectedSubject} n'a été trouvé.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLessons.map((lesson) => (
            <Card key={lesson.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700">
                      {lesson.subject}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(lesson.lesson_date)}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Enseignant: {lesson.teacher.first_name} {lesson.teacher.last_name}
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  {lesson.duration} min
                </div>
              </div>

              {/* Description */}
              {lesson.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Description du cours</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{lesson.description}</p>
                </div>
              )}

              {/* Devoirs */}
              {lesson.homework && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Devoirs à faire
                  </h4>
                  <p className="text-yellow-800 whitespace-pre-wrap">{lesson.homework}</p>
                </div>
              )}

              {/* Ressources */}
              {lesson.resources && lesson.resources.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Ressources pédagogiques
                  </h4>
                  <div className="space-y-2">
                    {lesson.resources.map((resource: any, index: number) => (
                      <a
                        key={index}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        {resource.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
