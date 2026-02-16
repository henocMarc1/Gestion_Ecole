'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface TimetableSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  room: string | null;
  teacher: {
    full_name: string;
  }[];
  class: {
    name: string;
    level: string;
  }[];
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

export default function HRTimetablePage() {
  const { user } = useAuth();
  const [timeSlots, setTimeSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [classes, setClasses] = useState<Array<{ id: string; name: string; level: string }>>([]);

  // Subscription en temps réel pour les classes
  useRealtimeSubscription({
    table: 'classes',
    filter: user?.school_id ? `school_id=eq.${user.school_id}` : undefined,
    onUpdate: () => {
      loadClasses();
    }
  });

  useEffect(() => {
    loadClasses();
  }, [user]);

  useEffect(() => {
    if (classes.length > 0) {
      loadTimetable();
    }
  }, [classes, selectedClass]);

  const loadClasses = async () => {
    try {
      if (!user?.school_id) return;

      const { data, error } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', user.school_id)
        .is('deleted_at', null)
        .order('level')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
      toast.error('Erreur lors du chargement des classes');
    }
  };

  const loadTimetable = async () => {
    try {
      setIsLoading(true);
      if (!user?.school_id) return;

      let query = supabase
        .from('timetable_slots')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          subject,
          room,
          teacher:teacher_id (
            full_name
          ),
          class:class_id (
            id,
            name,
            level,
            school_id
          )
        `)
        .eq('class.school_id', user.school_id)
        .order('day_of_week')
        .order('start_time');

      if (selectedClass !== 'all') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTimeSlots(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'emploi du temps:', error);
      toast.error('Erreur lors du chargement de l\'emploi du temps');
    } finally {
      setIsLoading(false);
    }
  };

  const getSlotsByDay = (day: number) => {
    return timeSlots.filter(slot => slot.day_of_week === day);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emploi du temps</h1>
          <p className="text-gray-600">Consultation des emplois du temps de l'école</p>
        </div>
      </div>

      {/* Filtre par classe */}
      <Card>
        <div className="flex items-center gap-4">
          <Icons.Search className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par classe
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Toutes les classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} - {cls.level}
                </option>
              ))}
            </select>
          </div>
          {selectedClass !== 'all' && (
            <button
              onClick={() => setSelectedClass('all')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </Card>

      {/* Grille de l'emploi du temps */}
      {timeSlots.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Icons.Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun emploi du temps
            </h3>
            <p className="text-gray-600">
              {selectedClass === 'all' 
                ? "Aucun emploi du temps n'a encore été configuré pour cette école."
                : "Aucun emploi du temps n'a été configuré pour cette classe."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {DAYS.map((day, index) => {
            const daySlots = getSlotsByDay(index + 1);
            
            if (daySlots.length === 0) return null;

            return (
              <div key={day}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Icons.Calendar className="w-5 h-5 text-primary-600" />
                  {day}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => (
                    <Card key={slot.id} className="hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm text-primary-700 font-medium mb-1">
                              {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                            </div>
                            <div className="font-semibold text-gray-900">
                              {slot.subject}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icons.BookOpen className="w-4 h-4" />
                            <span>{slot.class[0]?.name} ({slot.class[0]?.level})</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Icons.Users className="w-4 h-4" />
                            <span>{slot.teacher[0]?.full_name}</span>
                          </div>
                          {slot.room && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                <Icons.MapPin className="w-3 h-3 mr-1" />
                                Salle {slot.room}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note informative */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <Icons.Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Information</p>
            <p>
              Cette page vous permet de consulter tous les emplois du temps de l'école. 
              Vous pouvez filtrer par classe pour voir l'emploi du temps d'une classe spécifique.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
