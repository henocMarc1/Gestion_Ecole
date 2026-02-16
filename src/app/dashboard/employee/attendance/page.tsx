'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  overtime_hours: number;
  late_minutes: number;
  notes?: string;
}

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      loadData();
      // Vérifier toutes les heures
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadData = async () => {
    try {
      if (!user?.id) return;

      // Charger les informations de l'employé
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id, position, department, status')
        .eq('user_id', user.id)
        .single();

      if (employeeError) throw employeeError;
      setEmployee(employeeData);

      const today = new Date().toISOString().split('T')[0];

      // Charger le pointage d'aujourd'hui
      const { data: todayData, error: todayError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeData.id)
        .eq('date', today);

      if (todayError) throw todayError;
      setToday(todayData?.[0] || null);

      // Charger l'historique du mois en cours
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      const { data: historyData, error: historyError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeData.id)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date', { ascending: false });

      if (historyError) throw historyError;
      setHistory(historyData || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      if (!employee?.id) return;

      setIsChecking(true);
      const now = new Date();
      const time = now.toTimeString().slice(0, 5); // HH:MM
      const today = new Date().toISOString().split('T')[0];

      if (today) {
        // Insérer nouveau pointage
        const { error: insertError } = await supabase
          .from('attendance_records')
          .insert([
            {
              employee_id: employee.id,
              school_id: user?.school_id,
              date: today,
              check_in_time: time,
              status: 'present',
              recorded_by: user?.id,
            },
          ]);

        if (insertError) throw insertError;

        toast.success(`✅ Pointage entrée enregistré à ${time}`);
        await loadData();
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'enregistrement du pointage');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!today?.id) {
        toast.error('Aucun pointage d\'entrée pour aujourd\'hui');
        return;
      }

      setIsChecking(true);
      const now = new Date();
      const time = now.toTimeString().slice(0, 5); // HH:MM

      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: time,
        })
        .eq('id', today.id);

      if (updateError) throw updateError;

      toast.success(`✅ Pointage sortie enregistré à ${time}`);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'enregistrement du pointage');
    } finally {
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Icons.Clock className="w-12 h-12 mx-auto mb-4 animate-spin" />
          <p className="text-neutral-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const stats = {
    present: history.filter(a => a.status === 'present').length,
    absent: history.filter(a => a.status === 'absent').length,
    late: history.filter(a => a.status === 'late').length,
    onLeave: history.filter(a => a.status === 'on_leave').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            Gestion de ma Présence
          </h1>
          <p className="text-neutral-600">
            Marquez votre présence et consultez votre historique de présences
          </p>
        </div>

        {/* Today's Card */}
        <Card className="mb-8 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-blue-900 mb-1">
                  Aujourd'hui - {new Date().toLocaleDateString('fr-FR')}
                </h2>
                <p className="text-blue-700">{employee?.position || 'Employé'}</p>
              </div>
              <div className="text-4xl">🕐</div>
            </div>

            {/* Check In/Out Status */}
            {today ? (
              <div className="bg-white rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Check In */}
                  <div className="text-center">
                    <p className="text-sm text-neutral-600 mb-1">Heure d'arrivée</p>
                    <p className="text-2xl font-bold text-green-600">
                      {today.check_in_time || '---'}
                    </p>
                  </div>

                  {/* Check Out */}
                  <div className="text-center">
                    <p className="text-sm text-neutral-600 mb-1">Heure de départ</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {today.check_out_time || '---'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Status Badge */}
                  <div className="text-center">
                    <p className="text-sm text-neutral-600 mb-1">Statut</p>
                    <span className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${
                      today.status === 'present' ? 'bg-green-100 text-green-800' :
                      today.status === 'late' ? 'bg-orange-100 text-orange-800' :
                      today.status === 'absent' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {today.status === 'present' ? '✅ Présent' :
                       today.status === 'late' ? '⏰ En retard' :
                       today.status === 'absent' ? '❌ Absent' :
                       '🏖️ Congé'}
                    </span>
                  </div>

                  {/* Late Minutes */}
                  {today.late_minutes > 0 && (
                    <div className="text-center">
                      <p className="text-sm text-neutral-600 mb-1">Retard</p>
                      <p className="text-xl font-bold text-orange-600">
                        {today.late_minutes} min
                      </p>
                    </div>
                  )}
                </div>

                {/* Information Message */}
                <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                  <Icons.Info className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-blue-900 font-semibold mb-1">Pointage géré par le RH</p>
                  <p className="text-blue-700 text-sm">
                    Votre pointage est enregistré par le département des Ressources Humaines. Contactez votre RH pour toute demande.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-6">
                <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                  <Icons.Info className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-blue-900 font-semibold">Pointage géré par le RH</p>
                  <p className="text-blue-700 text-sm">
                    Contactez votre RH pour enregistrer votre pointage.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-center">
              <p className="text-3xl mb-1">✅</p>
              <p className="text-sm text-neutral-600 mb-1">Présents</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-3xl mb-1">❌</p>
              <p className="text-sm text-neutral-600 mb-1">Absents</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-3xl mb-1">⏰</p>
              <p className="text-sm text-neutral-600 mb-1">Retards</p>
              <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-3xl mb-1">🏖️</p>
              <p className="text-sm text-neutral-600 mb-1">Congés</p>
              <p className="text-2xl font-bold text-blue-600">{stats.onLeave}</p>
            </div>
          </Card>
        </div>

        {/* History */}
        <Card>
          <div className="p-6 border-b border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900">
              📅 Historique du mois
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Arrivée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Départ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700">
                    Détails
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                      Aucune présence enregistrée ce mois-ci
                    </td>
                  </tr>
                ) : (
                  history.map((record) => (
                    <tr key={record.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-neutral-900">
                          {new Date(record.date).toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-neutral-600">
                        {record.check_in_time || '---'}
                      </td>
                      <td className="px-6 py-3 text-neutral-600">
                        {record.check_out_time || '---'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'late' ? 'bg-orange-100 text-orange-800' :
                          record.status === 'absent' ? 'bg-red-100 text-red-800' :
                          record.status === 'half_day' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {record.status === 'present' ? '✅ Présent' :
                           record.status === 'late' ? '⏰ Retard' :
                           record.status === 'absent' ? '❌ Absent' :
                           record.status === 'half_day' ? '📝 Demi-journée' :
                           '🏖️ Congé'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-neutral-600">
                        {record.late_minutes > 0 && `${record.late_minutes} min de retard`}
                        {record.overtime_hours > 0 && `${record.overtime_hours}h sup`}
                        {record.notes && `${record.notes}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
