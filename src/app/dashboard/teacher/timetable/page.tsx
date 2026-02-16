'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription, RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

interface TimeSlot {
  id: string;
  class_id: string;
  class_name?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  room?: string;
}

export default function TeacherTimetablePage() {
  const { user } = useAuth();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);

  const daysOfWeek = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
  ];

  useEffect(() => {
    loadTimetable();
  }, [user]);

  // Abonnement aux changements en temps réel
  useRealtimeSubscription({
    table: 'timetable_slots',
    event: '*',
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!user?.id,
  });

  // Abonnement aux changements des classes
  useRealtimeSubscription({
    table: 'teacher_classes',
    event: '*',
    filter: `teacher_id=eq.${user?.id}`,
    onData: () => {
      // Si les classes changent, recharger complètement
      loadTimetable();
    },
    enabled: !!user?.id,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newSlot = payload.new as TimeSlot;
    const oldSlot = payload.old as TimeSlot;

    // Vérifier si le changement concerne une classe de cet enseignant
    const isMyClass = classes.some(c => c.id === newSlot.class_id);
    if (!isMyClass && payload.eventType !== 'DELETE') return;

    switch (payload.eventType) {
      case 'INSERT':
        setTimeSlots(prev => [
          ...prev,
          {
            ...newSlot,
            class_name: classes.find(c => c.id === newSlot.class_id)?.name || 'N/A',
          }
        ]);
        toast.success('Nouveau créneau ajouté');
        break;

      case 'UPDATE':
        setTimeSlots(prev =>
          prev.map(slot =>
            slot.id === newSlot.id
              ? { ...slot, ...newSlot }
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

  const loadTimetable = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Charger les classes de l'enseignant
      const { data: teacherClasses, error: classesError } = await supabase
        .from('teacher_classes')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', user.id);

      if (classesError) throw classesError;

      const classIds = (teacherClasses || []).map((tc: any) => tc.class_id);
      const classList = (teacherClasses || []).map((tc: any) => ({
        id: tc.classes.id,
        name: tc.classes.name,
      }));
      setClasses(classList);

      if (classIds.length === 0) {
        setTimeSlots([]);
        return;
      }

      // Charger les créneaux de toutes les classes de l'enseignant
      const { data: slots, error: slotsError } = await supabase
        .from('timetable_slots')
        .select(`
          *,
          classes(name)
        `)
        .in('class_id', classIds)
        .order('day_of_week')
        .order('start_time');

      if (slotsError) throw slotsError;

      const formattedSlots = (slots || []).map((slot: any) => ({
        ...slot,
        class_name: slot.classes?.name || 'N/A',
      }));

      setTimeSlots(formattedSlots);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement de l\'emploi du temps');
    } finally {
      setIsLoading(false);
    }
  };

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
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Mon emploi du temps</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Consultez vos horaires de cours
        </p>
      </div>

      {/* Info Classes */}
      {classes.length > 0 && (
        <Card className="border border-neutral-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <Icons.BookOpen className="w-4 h-4 text-primary-600" />
            <span className="font-medium">Mes classes :</span>
            <span>{classes.map(c => c.name).join(', ')}</span>
          </div>
        </Card>
      )}

      {/* Timetable */}
      <Card className="border border-neutral-200 shadow-sm p-6">
        {timeSlots.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Calendar className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600 font-medium">Aucun créneau défini</p>
            <p className="text-sm text-neutral-500 mt-1">
              Votre emploi du temps sera disponible une fois configuré par l'administration
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
                        className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-primary-700">
                              {slot.start_time} - {slot.end_time}
                            </span>
                            <span className="font-semibold text-neutral-900">
                              {slot.subject}
                            </span>
                            {classes.length > 1 && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                {slot.class_name}
                              </span>
                            )}
                            {slot.room && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                Salle {slot.room}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
