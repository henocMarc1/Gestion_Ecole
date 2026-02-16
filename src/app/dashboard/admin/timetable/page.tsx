'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface Class {
  id: string;
  name: string;
  level: string;
}

interface TimeSlot {
  id: string;
  class_id: string;
  day_of_week: number; // 1=Lundi, 5=Vendredi
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string;
  teacher_name?: string;
  room?: string;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [principalTeacher, setPrincipalTeacher] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
    subject: '',
    room: '',
  });

  const daysOfWeek = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
  ];

  const timeSlotOptions = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadTimeSlots();
    }
  }, [selectedClass]);

  // Abonnement aux changements en temps réel de l'emploi du temps
  useRealtimeSubscription({
    table: 'timetable_slots',
    event: '*',
    filter: `class_id=eq.${selectedClass}`,
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!selectedClass,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newSlot = payload.new;
    const oldSlot = payload.old;

    switch (payload.eventType) {
      case 'INSERT':
        setTimeSlots(prev => [
          ...prev,
          {
            id: newSlot.id,
            class_id: newSlot.class_id,
            day_of_week: newSlot.day_of_week,
            start_time: newSlot.start_time,
            end_time: newSlot.end_time,
            subject: newSlot.subject,
            teacher_id: newSlot.teacher_id,
            room: newSlot.room,
          }
        ]);
        toast.success('Créneau ajouté par quelqu\'un d\'autre');
        break;

      case 'UPDATE':
        setTimeSlots(prev =>
          prev.map(slot =>
            slot.id === newSlot.id
              ? {
                  ...slot,
                  day_of_week: newSlot.day_of_week,
                  start_time: newSlot.start_time,
                  end_time: newSlot.end_time,
                  subject: newSlot.subject,
                  teacher_id: newSlot.teacher_id,
                  room: newSlot.room,
                }
              : slot
          )
        );
        toast.success('Créneau mis à jour');
        break;

      case 'DELETE':
        setTimeSlots(prev => prev.filter(slot => slot.id !== oldSlot.id));
        toast.success('Créneau supprimé');
        break;
    }
  };

  const loadData = async () => {
    if (!user?.school_id) return;
    setIsLoading(true);
    try {
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('name');

      if (classesError) throw classesError;

      setClasses(classesData || []);

      if (classesData && classesData.length > 0) {
        setSelectedClass(classesData[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimeSlots = async () => {
    if (!selectedClass) return;
    try {
      // Charger l'enseignant principal de la classe
      const { data: teacherData, error: teacherError } = await supabase
        .from('teacher_classes')
        .select('teacher:users(id, full_name)')
        .eq('class_id', selectedClass)
        .eq('is_main_teacher', true)
        .single();

      if (teacherError && teacherError.code !== 'PGRST116') {
        console.error('Erreur enseignant:', teacherError);
      }

      if (teacherData?.teacher) {
        setPrincipalTeacher(teacherData.teacher);
      } else {
        setPrincipalTeacher(null);
      }

      // Charger les créneaux horaires
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('class_id', selectedClass)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;

      setTimeSlots(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement de l\'emploi du temps');
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !formData.subject) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!principalTeacher) {
      toast.error('Aucun enseignant principal assigné à cette classe');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase.from('timetable_slots').insert([{
        class_id: selectedClass,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        subject: formData.subject,
        teacher_id: principalTeacher.id,
        room: formData.room || null,
      }]);

      if (error) throw error;

      toast.success('Créneau ajouté avec succès');
      setIsModalOpen(false);
      setFormData({
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
        subject: '',
        room: '',
      });
      loadTimeSlots();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de la création du créneau');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) return;

    try {
      const { error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;

      toast.success('Créneau supprimé');
      loadTimeSlots();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

  // Grouper les créneaux par jour
  const slotsByDay = timeSlots.reduce((acc, slot) => {
    if (!acc[slot.day_of_week]) {
      acc[slot.day_of_week] = [];
    }
    acc[slot.day_of_week].push(slot);
    return acc;
  }, {} as Record<number, TimeSlot[]>);

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        <p className="text-sm text-neutral-600 mt-3">Chargement...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Emploi du temps</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Gérez les emplois du temps de chaque classe
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={!selectedClass}
        >
          <Icons.Plus className="w-4 h-4 mr-2" />
          Ajouter un créneau
        </Button>
      </div>

      {/* Class Selector */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-neutral-700">
            Sélectionner une classe :
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} - {cls.level}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Timetable Grid */}
      {selectedClass && (
        <Card className="border border-neutral-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Emploi du temps - {selectedClassName}
            </h2>
            {principalTeacher && (
              <div className="flex items-center gap-2 mt-2 text-sm text-neutral-600">
                <Icons.Users className="w-4 h-4" />
                <span>Enseignant: {principalTeacher.full_name}</span>
              </div>
            )}
            {!principalTeacher && (
              <div className="flex items-center gap-2 mt-2 text-sm text-amber-600">
                <Icons.Users className="w-4 h-4" />
                <span>Aucun enseignant principal assigné</span>
              </div>
            )}
          </div>

          {timeSlots.length === 0 ? (
            <div className="text-center py-12">
              <Icons.Calendar className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 font-medium">Aucun créneau défini</p>
              <p className="text-sm text-neutral-500 mt-1">
                Cliquez sur "Ajouter un créneau" pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {daysOfWeek.map((day) => {
                const daySlots = slotsByDay[day.value] || [];
                if (daySlots.length === 0) return null;

                return (
                  <div key={day.value} className="border border-neutral-200 rounded-lg p-4">
                    <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <Icons.Calendar className="w-5 h-5 text-primary-600" />
                      {day.label}
                    </h3>
                    <div className="space-y-2">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-primary-700">
                                {slot.start_time} - {slot.end_time}
                              </span>
                              <span className="font-semibold text-neutral-900">
                                {slot.subject}
                              </span>
                              {slot.room && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                  Salle {slot.room}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Icons.Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add Slot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg border-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Ajouter un créneau
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  <Icons.X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleCreateSlot} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Jour <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    {daysOfWeek.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Heure de début <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      {timeSlotOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Heure de fin <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      {timeSlotOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Matière <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Ex: Mathématiques, Français..."
                    required
                  />
                </div>

                {principalTeacher && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-blue-900">
                      <Icons.Users className="w-4 h-4" />
                      <span>
                        <strong>Enseignant:</strong> {principalTeacher.full_name}
                      </span>
                    </div>
                  </div>
                )}

                {!principalTeacher && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-amber-900">
                      <Icons.Users className="w-4 h-4" />
                      <span>
                        Aucun enseignant principal assigné à cette classe. Veuillez d'abord assigner un enseignant principal.
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Salle (optionnel)
                  </label>
                  <Input
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="Ex: A101, B205..."
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1"
                    disabled={isCreating}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Création...' : 'Créer'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
