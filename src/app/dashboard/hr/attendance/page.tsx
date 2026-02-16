'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  overtime_hours: number;
  late_minutes: number;
  notes: string | null;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    position: string;
  };
}

export default function HRAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Form pour enregistrer un pointage
  const [newAttendance, setNewAttendance] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    check_in_time: '',
    check_out_time: '',
    status: 'present' as const,
    notes: '',
  });

  useEffect(() => {
    if (user?.school_id) {
      loadEmployees();
      loadAttendance();
    }
  }, [user?.school_id, selectedDate]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, position, status')
        .eq('school_id', user?.school_id)
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Erreur chargement employés:', err);
      toast.error('Erreur lors du chargement des employés');
    }
  };

  const loadAttendance = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          employees:employee_id(
            id,
            first_name,
            last_name,
            position
          )
        `)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttendance(data || []);
    } catch (err) {
      console.error('Erreur chargement pointages:', err);
      toast.error('Erreur lors du chargement des pointages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAttendance = async () => {
    if (!newAttendance.employee_id) {
      toast.error('Sélectionnez un employé');
      return;
    }

    try {
      const { error } = await supabase.from('attendance_records').insert([
        {
          school_id: user?.school_id,
          employee_id: newAttendance.employee_id,
          date: newAttendance.date,
          check_in_time: newAttendance.check_in_time || null,
          check_out_time: newAttendance.check_out_time || null,
          status: newAttendance.status,
          notes: newAttendance.notes || null,
          recorded_by: user?.id,
        },
      ]);

      if (error) throw error;
      toast.success('Pointage enregistré');
      setNewAttendance({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        check_in_time: '',
        check_out_time: '',
        status: 'present',
        notes: '',
      });
      await loadAttendance();
    } catch (err: any) {
      console.error('Erreur:', err);
      if (err.message.includes('duplicate')) {
        toast.error('Un pointage existe déjà pour cet employé ce jour');
      } else {
        toast.error('Erreur lors de l\'enregistrement');
      }
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('Supprimer ce pointage ?')) return;

    try {
      const { error } = await supabase.from('attendance_records').delete().eq('id', id);
      if (error) throw error;
      toast.success('Pointage supprimé');
      await loadAttendance();
    } catch (err) {
      console.error('Erreur:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredAttendance = useMemo(() => {
    if (!selectedEmployee) return attendance;
    return attendance.filter(a => a.employee_id === selectedEmployee);
  }, [attendance, selectedEmployee]);

  const stats = useMemo(
    () => ({
      total: filteredAttendance.length,
      present: filteredAttendance.filter(a => a.status === 'present' || a.status === 'late').length,
      absent: filteredAttendance.filter(a => a.status === 'absent').length,
      onLeave: filteredAttendance.filter(a => a.status === 'on_leave').length,
    }),
    [filteredAttendance]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-orange-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-orange-600 uppercase">Pointage</p>
            <h1 className="text-3xl font-semibold text-neutral-900">Gestion des pointages</h1>
            <p className="text-sm text-neutral-600 mt-1">Enregistrez et gérez les pointages du personnel</p>
          </div>
          <Button variant="outline" onClick={loadAttendance}>
            <Icons.Activity className="w-4 h-4 mr-2" /> Actualiser
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-white border border-neutral-200">
            <p className="text-xs text-neutral-600 uppercase font-semibold">Total pointé</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.total}</p>
          </Card>
          <Card className="p-4 bg-white border border-emerald-200">
            <p className="text-xs text-emerald-600 uppercase font-semibold">Présents</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.present}</p>
          </Card>
          <Card className="p-4 bg-white border border-red-200">
            <p className="text-xs text-red-600 uppercase font-semibold">Absents</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{stats.absent}</p>
          </Card>
          <Card className="p-4 bg-white border border-amber-200">
            <p className="text-xs text-amber-600 uppercase font-semibold">En congé</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{stats.onLeave}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form - Enregistrer un pointage */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Enregistrer un pointage</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Employé</label>
                <select
                  value={newAttendance.employee_id}
                  onChange={e => setNewAttendance({ ...newAttendance, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Sélectionner un employé</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.position}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newAttendance.date}
                  onChange={e => setNewAttendance({ ...newAttendance, date: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Entrée</label>
                  <input
                    type="time"
                    value={newAttendance.check_in_time}
                    onChange={e => setNewAttendance({ ...newAttendance, check_in_time: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Sortie</label>
                  <input
                    type="time"
                    value={newAttendance.check_out_time}
                    onChange={e => setNewAttendance({ ...newAttendance, check_out_time: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Statut</label>
                <select
                  value={newAttendance.status}
                  onChange={e => setNewAttendance({ ...newAttendance, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="present">Présent</option>
                  <option value="late">En retard</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Demi-journée</option>
                  <option value="on_leave">En congé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                <textarea
                  value={newAttendance.notes}
                  onChange={e => setNewAttendance({ ...newAttendance, notes: e.target.value })}
                  placeholder="Notes optionnelles..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={3}
                />
              </div>

              <Button onClick={handleCreateAttendance} className="w-full bg-orange-600 hover:bg-orange-700">
                <Icons.Plus className="w-4 h-4 mr-2" /> Enregistrer
              </Button>
            </div>
          </Card>

          {/* List - Pointages du jour */}
          <Card className="p-6 bg-white border border-neutral-200 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Pointages du {new Date(selectedDate).toLocaleDateString('fr-FR')}</h2>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                />
                <select
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Tous les employés</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <p className="text-center text-neutral-600 py-8">Chargement...</p>
            ) : filteredAttendance.length === 0 ? (
              <p className="text-center text-neutral-500 py-8">Aucun pointage enregistré</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Employé</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Position</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Entrée</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Sortie</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Statut</th>
                      <th className="text-left px-3 py-2 font-semibold text-neutral-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredAttendance.map(record => (
                      <tr key={record.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-3">
                          <span className="font-medium text-neutral-900">
                            {record.employees.first_name} {record.employees.last_name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-neutral-600">{record.employees.position}</td>
                        <td className="px-3 py-3 text-neutral-900 font-medium">{record.check_in_time || '-'}</td>
                        <td className="px-3 py-3 text-neutral-900 font-medium">{record.check_out_time || '-'}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              record.status === 'present'
                                ? 'bg-emerald-100 text-emerald-700'
                                : record.status === 'late'
                                ? 'bg-amber-100 text-amber-700'
                                : record.status === 'absent'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {record.status === 'present'
                              ? 'Présent'
                              : record.status === 'late'
                              ? 'Retard'
                              : record.status === 'absent'
                              ? 'Absent'
                              : record.status === 'on_leave'
                              ? 'Congé'
                              : 'Demi-journée'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleDeleteAttendance(record.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
