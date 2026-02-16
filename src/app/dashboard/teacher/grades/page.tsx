'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileText, Save, Plus, Trash2, Edit2 } from 'lucide-react';

interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  grade: number;
  maxGrade: number;
  date: string;
  term: string;
}

interface Class {
  id: string;
  name: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

export default function TeacherGradesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [newGrade, setNewGrade] = useState({
    studentId: '',
    subject: '',
    grade: '',
    maxGrade: '20',
    date: new Date().toISOString().split('T')[0],
    term: 'Trimestre 1',
  });

  // Real-time subscriptions
  useRealtimeSubscription({
    table: 'grades',
    event: '*',
    onData: () => {
      if (selectedClass) {
        loadGrades(selectedClass);
      }
    },
    enabled: true,
  });

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(data);
      }
    };
    getCurrentUser();
  }, []);

  // Load teacher's classes
  const loadClasses = async () => {
    try {
      if (!currentUser) return;

      // Get classes assigned to this teacher
      const { data } = await supabase
        .from('class_teachers')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', currentUser.id);

      if (data) {
        const classList = data.map((ct: any) => ct.classes).filter(Boolean);
        setClasses(classList);
        if (classList.length > 0) {
          setSelectedClass(classList[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  // Load students for selected class
  const loadStudents = async (classId: string) => {
    try {
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('class_id', classId)
        .order('last_name');

      if (data) {
        setStudents(data);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  // Load grades for selected class
  const loadGrades = async (classId: string) => {
    try {
      const { data } = await supabase
        .from('grades')
        .select('id, student_id, subject, grade, max_grade, date, term, students(first_name, last_name)')
        .eq('classes.id', classId)
        .order('date', { ascending: false });

      if (data) {
        const formattedGrades = data.map((g: any) => ({
          id: g.id,
          studentId: g.student_id,
          studentName: `${g.students?.first_name} ${g.students?.last_name}`,
          subject: g.subject,
          grade: g.grade,
          maxGrade: g.max_grade,
          date: g.date,
          term: g.term,
        }));
        setGrades(formattedGrades);
      }
    } catch (error) {
      console.error('Error loading grades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save grade
  const handleSaveGrade = async () => {
    if (!newGrade.studentId || !newGrade.subject || !newGrade.grade) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    setIsSaving(true);
    try {
      if (editingGrade) {
        // Update existing grade
        await supabase
          .from('grades')
          .update({
            subject: newGrade.subject,
            grade: parseFloat(newGrade.grade),
            max_grade: parseFloat(newGrade.maxGrade),
            date: newGrade.date,
            term: newGrade.term,
          })
          .eq('id', editingGrade);
      } else {
        // Insert new grade
        await supabase.from('grades').insert({
          student_id: newGrade.studentId,
          teacher_id: currentUser.id,
          subject: newGrade.subject,
          grade: parseFloat(newGrade.grade),
          max_grade: parseFloat(newGrade.maxGrade),
          date: newGrade.date,
          term: newGrade.term,
        });
      }

      setNewGrade({
        studentId: '',
        subject: '',
        grade: '',
        maxGrade: '20',
        date: new Date().toISOString().split('T')[0],
        term: 'Trimestre 1',
      });
      setEditingGrade(null);
      await loadGrades(selectedClass);
    } catch (error) {
      console.error('Error saving grade:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete grade
  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note?')) return;

    try {
      await supabase
        .from('grades')
        .delete()
        .eq('id', gradeId);

      await loadGrades(selectedClass);
    } catch (error) {
      console.error('Error deleting grade:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Edit grade
  const handleEditGrade = (grade: Grade) => {
    setNewGrade({
      studentId: grade.studentId,
      subject: grade.subject,
      grade: grade.grade.toString(),
      maxGrade: grade.maxGrade.toString(),
      date: grade.date,
      term: grade.term,
    });
    setEditingGrade(grade.id);
  };

  // Initialize
  useEffect(() => {
    if (currentUser) {
      loadClasses();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
      loadGrades(selectedClass);
    }
  }, [selectedClass]);

  const getGradeColor = (grade: number, maxGrade: number) => {
    const percentage = (grade / maxGrade) * 100;
    if (percentage >= 80) return 'bg-green-100 text-green-800';
    if (percentage >= 60) return 'bg-yellow-100 text-yellow-800';
    if (percentage >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="w-12 h-12 text-primary-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Chargement des notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Notes</h1>
        <p className="text-gray-600 mt-2">Entrez et gérez les notes des élèves</p>
      </div>

      {/* Class selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Classe</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            <option value="">Sélectionner une classe</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          {/* Grade entry form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {editingGrade ? 'Modifier une note' : 'Ajouter une note'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Élève *
                  </label>
                  <select
                    value={newGrade.studentId}
                    onChange={(e) => setNewGrade({ ...newGrade, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                    disabled={editingGrade !== null}
                  >
                    <option value="">Sélectionner un élève</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matière *
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: Mathématiques"
                    value={newGrade.subject}
                    onChange={(e) => setNewGrade({ ...newGrade, subject: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note *
                  </label>
                  <Input
                    type="number"
                    placeholder="ex: 18"
                    value={newGrade.grade}
                    onChange={(e) => setNewGrade({ ...newGrade, grade: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note maximale
                  </label>
                  <Input
                    type="number"
                    value={newGrade.maxGrade}
                    onChange={(e) => setNewGrade({ ...newGrade, maxGrade: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={newGrade.date}
                    onChange={(e) => setNewGrade({ ...newGrade, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trimestre
                  </label>
                  <select
                    value={newGrade.term}
                    onChange={(e) => setNewGrade({ ...newGrade, term: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  >
                    <option>Trimestre 1</option>
                    <option>Trimestre 2</option>
                    <option>Trimestre 3</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleSaveGrade}
                  disabled={isSaving}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingGrade ? 'Modifier' : 'Ajouter'}
                </Button>
                {editingGrade && (
                  <Button
                    onClick={() => {
                      setEditingGrade(null);
                      setNewGrade({
                        studentId: '',
                        subject: '',
                        grade: '',
                        maxGrade: '20',
                        date: new Date().toISOString().split('T')[0],
                        term: 'Trimestre 1',
                      });
                    }}
                    variant="outline"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Grades list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes enregistrées</CardTitle>
            </CardHeader>
            <CardContent>
              {grades.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune note pour le moment</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Élève</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Matière</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-700">Note</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Trimestre</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {grades.map((grade) => (
                        <tr key={grade.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{grade.studentName}</td>
                          <td className="px-4 py-2 text-gray-900">{grade.subject}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-3 py-1 rounded-full font-medium ${getGradeColor(grade.grade, grade.maxGrade)}`}>
                              {grade.grade}/{grade.maxGrade}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {new Date(grade.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{grade.term}</td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleEditGrade(grade)}
                                className="text-primary-600 hover:text-primary-700 p-1 hover:bg-primary-50 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGrade(grade.id)}
                                className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
