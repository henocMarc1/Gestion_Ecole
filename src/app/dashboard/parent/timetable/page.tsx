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
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  room?: string;
}

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  class_name?: string;
  class_level?: string;
}

export default function ParentTimetablePage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const daysOfWeek = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
  ];

  useEffect(() => {
    loadChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      loadTimetable();
    }
  }, [selectedChild]);

  // Abonnement aux changements de l'emploi du temps
  useRealtimeSubscription({
    table: 'timetable_slots',
    event: '*',
    onData: (payload) => {
      handleRealtimeUpdate(payload);
    },
    enabled: !!selectedChild,
  });

  // Abonnement aux changements des classes des enfants
  useRealtimeSubscription({
    table: 'students',
    event: 'UPDATE',
    onData: () => {
      // Si les classes des enfants changent, recharger
      loadChildren();
    },
    enabled: !!user?.id,
  });

  const handleRealtimeUpdate = (payload: RealtimePayload) => {
    const newSlot = payload.new;
    const oldSlot = payload.old;
    
    const selectedChildData = children.find(c => c.id === selectedChild);
    if (!selectedChildData) return;

    // Charger la classe de l'enfant sélectionné pour vérifier si ça le concerne
    // Ici on doit comparer class_id avec la classe de l'enfant
    // Puisqu'on ne peut pas facilement l'avoir, on recharge simplement
    if (payload.eventType !== 'DELETE') {
      // On recharge l'emploi du temps pour vérifier
      loadTimetable();
    }
  };

  const loadChildren = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
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
      if (childrenList.length > 0) {
        setSelectedChild(childrenList[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des enfants');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimetable = async () => {
    if (!selectedChild) return;
    try {
      // Trouver la classe de l'enfant
      const child = children.find(c => c.id === selectedChild);
      if (!child) return;

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', selectedChild)
        .single();

      if (studentError) throw studentError;
      if (!studentData?.class_id) {
        setTimeSlots([]);
        return;
      }

      // Charger les créneaux de la classe
      const { data: slots, error: slotsError } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('class_id', studentData.class_id)
        .order('day_of_week')
        .order('start_time');

      if (slotsError) throw slotsError;

      setTimeSlots(slots || []);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement de l\'emploi du temps');
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

  const selectedChildData = children.find(c => c.id === selectedChild);

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 mx-auto" />
        <p className="text-sm text-neutral-600 mt-3">Chargement...</p>
      </Card>
    );
  }

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Emploi du temps</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Consultez l'emploi du temps de vos enfants
          </p>
        </div>
        <Card className="p-12 text-center border border-dashed border-neutral-300">
          <Icons.Users className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 font-medium">Aucun enfant inscrit</p>
          <p className="text-sm text-neutral-500 mt-1">
            Contactez l'administration pour l'inscription
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">Emploi du temps</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Consultez l'emploi du temps de vos enfants
        </p>
      </div>

      {/* Sélecteur d'enfant */}
      <Card className="border border-neutral-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-neutral-700">
            Sélectionner un enfant :
          </label>
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.first_name} {child.last_name} - {child.class_name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Info classe */}
      {selectedChildData && (
        <Card className="border border-neutral-200 shadow-sm p-4 bg-primary-50">
          <div className="flex items-center gap-2 text-sm">
            <Icons.BookOpen className="w-4 h-4 text-primary-600" />
            <span className="font-medium text-primary-900">
              Classe : {selectedChildData.class_name} ({selectedChildData.class_level})
            </span>
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
              L'emploi du temps sera disponible une fois configuré par l'école
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
