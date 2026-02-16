'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REFUSED'

type LeaveRequestRow = {
  id: string
  staff_id?: string | null
  staff_name: string
  role: string
  type: string
  start_date: string
  end_date: string
  days?: number | null
  status: LeaveStatus
  reason: string
  school_id?: string | null
}

interface LeaveRequest {
  id: string
  staffName: string
  role: string
  type: 'Congé payé' | 'Maladie' | 'Sans solde' | 'Urgence'
  startDate: string
  endDate: string
  days: number
  status: LeaveStatus
  reason: string
}

interface CurrentUser {
  id: string
  full_name: string
  role: string
  school_id: string | null
}

export default function HRLeavesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL')
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [hasEmployeeRecord, setHasEmployeeRecord] = useState(true)
  const [newRequest, setNewRequest] = useState({
    type: 'Congé payé' as LeaveRequest['type'],
    startDate: '',
    endDate: '',
    reason: '',
  })

  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter(r => r.status === 'PENDING').length
    const approved = requests.filter(r => r.status === 'APPROVED').length
    const refused = requests.filter(r => r.status === 'REFUSED').length
    return { total, pending, approved, refused }
  }, [requests])

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? requests : requests.filter(r => r.status === statusFilter)),
    [requests, statusFilter]
  )

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRequests([])
        setCurrentUser(null)
        return
      }

      // Récupérer le profil de l'utilisateur (école + rôle + nom)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, role, school_id')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      const schoolId = userData?.school_id
      setCurrentUser(userData as CurrentUser)

      // Récupérer les demandes de congés avec les infos de l'employé associé
      let query = supabase
        .from('leave_requests')
        .select(`
          id,
          employee_id,
          leave_type,
          start_date,
          end_date,
          total_days,
          reason,
          status,
          school_id,
          employees:employee_id(first_name, last_name, position)
        `)

      if (schoolId) {
        query = query.eq('school_id', schoolId)
      }

      const { data, error } = await query.order('start_date', { ascending: false })

      if (error) throw error

      // Mapper les types et statuts
      const typeMap: Record<string, LeaveRequest['type']> = {
        'annual': 'Congé payé',
        'sick': 'Maladie',
        'unpaid': 'Sans solde',
        'other': 'Urgence',
        'maternity': 'Congé payé',
        'paternity': 'Congé payé',
      }

      const statusMap: Record<string, LeaveStatus> = {
        'pending': 'PENDING',
        'approved': 'APPROVED',
        'rejected': 'REFUSED',
        'cancelled': 'REFUSED',
      }

      const mapped: LeaveRequest[] = (data || []).map((item: any) => {
        const employee = item.employees
        const staffName = employee 
          ? `${employee.first_name} ${employee.last_name}`
          : 'Personnel'
        return {
          id: item.id,
          staffName,
          role: employee?.position || 'STAFF',
          type: typeMap[item.leave_type] || 'Congé payé',
          startDate: item.start_date,
          endDate: item.end_date,
          days: item.total_days || computeDays(item.start_date, item.end_date),
          status: statusMap[item.status] || 'PENDING',
          reason: item.reason || '',
        }
      })

      setRequests(mapped)
    } catch (err) {
      console.error('Erreur chargement congés', err)
      toast.error('Impossible de charger les congés.')
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const updateStatus = async (id: string, status: LeaveStatus) => {
    const previous = requests.find(r => r.id === id)?.status
    setRequests(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))

    // Mapper le statut UI vers le statut BD
    const statusMap: Record<LeaveStatus, string> = {
      'PENDING': 'pending',
      'APPROVED': 'approved',
      'REFUSED': 'rejected',
    }

    // Si l'id n'est pas un UUID (cas des données démo), on ne tente pas Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (!isUuid) {
      toast.info('Modification locale (donnée de démonstration)')
      return
    }

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: statusMap[status] })
        .eq('id', id)

      if (error) throw error
      toast.success('Statut mis à jour')
    } catch (err) {
      console.error('Erreur maj statut congé', err)
      toast.error('Mise à jour échouée')
      if (previous) {
        setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: previous } : r)))
      }
    }
  }

  const statusPill = (status: LeaveStatus) => {
    const map: Record<LeaveStatus, { color: string; label: string }> = {
      PENDING: { color: 'bg-amber-100 text-amber-700', label: 'En attente' },
      APPROVED: { color: 'bg-emerald-100 text-emerald-700', label: 'Approuvé' },
      REFUSED: { color: 'bg-red-100 text-red-700', label: 'Refusé' },
    }
    const cfg = map[status]
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
  }

  const computeDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diff = Math.max(0, endDate.getTime() - startDate.getTime())
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  }

  const handleCreateRequest = async () => {
    if (!newRequest.startDate || !newRequest.endDate || !newRequest.reason.trim()) {
      toast.error('Complétez les dates et le motif')
      return
    }

    const days = computeDays(newRequest.startDate, newRequest.endDate)
    if (days <= 0) {
      toast.error('Vérifiez les dates (fin après début)')
      return
    }

    const baseName = currentUser?.full_name || 'Utilisateur'
    const baseRole = currentUser?.role || 'STAFF'

    if (!currentUser?.school_id) {
      toast.error('Informations d\'école manquantes')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Non authentifié')
        return
      }

      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (empError) {
        console.error('Pas d\'enregistrement employee trouvé:', empError)
        setHasEmployeeRecord(false)
        toast.error('Profil employé non trouvé. Contactez l\'administrateur.')
        return
      }

      if (!employeeData) {
        console.error('Employee data vide pour RH user:', user.id)
        setHasEmployeeRecord(false)
        toast.error('Profil employé non trouvé')
        return
      }
      setHasEmployeeRecord(true)

      const typeMap: Record<string, string> = {
        'Congé payé': 'annual',
        'Maladie': 'sick',
        'Sans solde': 'unpaid',
        'Urgence': 'other',
      }

      const payload = {
        school_id: currentUser.school_id,
        employee_id: employeeData.id,
        leave_type: typeMap[newRequest.type] || 'other',
        start_date: newRequest.startDate,
        end_date: newRequest.endDate,
        total_days: days,
        reason: newRequest.reason,
        status: 'pending',
      }

      const { error } = await supabase.from('leave_requests').insert(payload)
      if (error) throw error
      toast.success('Demande envoyée')
      setNewRequest({ type: 'Congé payé', startDate: '', endDate: '', reason: '' })
      await loadRequests()
    } catch (err) {
      console.error('Erreur création congé', err)
      toast.error('Envoi impossible')
    }
  }

  useRealtimeSubscription({
    table: 'leave_requests',
    event: '*',
    filter: currentUser?.school_id ? `school_id=eq.${currentUser.school_id}` : undefined,
    onData: () => loadRequests(),
    enabled: true,
  })

  const leaveRequestFilter = useMemo(
    () => (currentUser?.school_id ? `school_id=eq.${currentUser.school_id}` : undefined),
    [currentUser?.school_id]
  )

  const handleRealtimeUpdate = useCallback(() => {
    loadRequests()
  }, [loadRequests])

  useRealtimeSubscription({
    table: 'leave_requests',
    event: '*',
    filter: leaveRequestFilter,
    onData: handleRealtimeUpdate,
    enabled: true,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-orange-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-orange-600 uppercase">Congés</p>
            <h1 className="text-3xl font-semibold text-neutral-900">Gestion des demandes</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Visualisez, approuvez ou refusez les demandes de congé du personnel.
            </p>
            <div className="flex gap-2 mt-3 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-neutral-200">
                <Icons.Calendar className="w-3.5 h-3.5 text-orange-600" /> {stats.total} demandes
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-neutral-200">
                <Icons.Activity className="w-3.5 h-3.5 text-amber-600" /> {stats.pending} en attente
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-neutral-200">
                <Icons.Check className="w-3.5 h-3.5 text-emerald-600" /> {stats.approved} approuvés
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadRequests} disabled={isLoading}>
              <Icons.Activity className="w-4 h-4 mr-2" /> Actualiser
            </Button>
            <Button variant="outline">
              <Icons.Download className="w-4 h-4 mr-2" /> Exporter
            </Button>
          </div>
        </div>

        <Card className="border border-neutral-200 shadow-sm p-6">
          {!hasEmployeeRecord ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-center gap-3">
                <Icons.AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-900">Profil employé non trouvé</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Votre profil employé n'est pas configuré dans le système. Veuillez contacter l'administration pour ajouter votre profil RH.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-neutral-900">Demander un congé</h2>
                <span className="text-sm text-neutral-500">Soumis au RH pour validation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-neutral-600">Type</label>
                  <select
                    value={newRequest.type}
                    onChange={e => setNewRequest(v => ({ ...v, type: e.target.value as LeaveRequest['type'] }))}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option>Congé payé</option>
                    <option>Maladie</option>
                    <option>Sans solde</option>
                    <option>Urgence</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-neutral-600">Début</label>
                  <input
                    type="date"
                    value={newRequest.startDate}
                    onChange={e => setNewRequest(v => ({ ...v, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-neutral-600">Fin</label>
                  <input
                    type="date"
                    value={newRequest.endDate}
                    onChange={e => setNewRequest(v => ({ ...v, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-neutral-600">Motif</label>
                  <input
                    type="text"
                    placeholder="Ex: urgence familiale"
                    value={newRequest.reason}
                    onChange={e => setNewRequest(v => ({ ...v, reason: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateRequest} disabled={isLoading || !currentUser}>
                  <Icons.Plus className="w-4 h-4 mr-2" /> Envoyer la demande
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 border border-neutral-200">
            <p className="text-xs text-neutral-600">Total</p>
            <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
          </Card>
          <Card className="p-4 border border-neutral-200">
            <p className="text-xs text-neutral-600">En attente</p>
            <p className="text-2xl font-semibold text-amber-700">{stats.pending}</p>
          </Card>
          <Card className="p-4 border border-neutral-200">
            <p className="text-xs text-neutral-600">Approuvés</p>
            <p className="text-2xl font-semibold text-emerald-700">{stats.approved}</p>
          </Card>
          <Card className="p-4 border border-neutral-200">
            <p className="text-xs text-neutral-600">Refusés</p>
            <p className="text-2xl font-semibold text-red-700">{stats.refused}</p>
          </Card>
        </div>

        <Card className="border border-neutral-200 shadow-sm">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Demandes en cours</h2>
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'PENDING', 'APPROVED', 'REFUSED'] as const).map(key => {
                    const labels: Record<typeof key, string> = {
                      ALL: 'Toutes',
                      PENDING: 'En attente',
                      APPROVED: 'Approuvées',
                      REFUSED: 'Refusées',
                    }
                  const isActive = statusFilter === key
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        isActive
                          ? 'border-orange-600 bg-orange-50 text-orange-700'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-orange-200'
                      }`}
                    >
                      {labels[key]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-sm text-neutral-600">
                    <th className="py-3 px-4 font-semibold">Personnel</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold">Période</th>
                    <th className="py-3 px-4 font-semibold">Jours</th>
                    <th className="py-3 px-4 font-semibold">Statut</th>
                    <th className="py-3 px-4 font-semibold">Motif</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-center text-sm text-neutral-500">
                        Chargement...
                      </td>
                    </tr>
                  )}

                  {!isLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-center text-sm text-neutral-500">
                        Aucune demande pour ce filtre.
                      </td>
                    </tr>
                  )}

                  {filtered.map(req => (
                    <tr key={req.id} className="border-b border-neutral-100 hover:bg-neutral-50 text-sm">
                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-900">{req.staffName}</div>
                        <div className="text-neutral-500 text-xs">{req.role}</div>
                      </td>
                      <td className="py-3 px-4 text-neutral-700">{req.type}</td>
                      <td className="py-3 px-4 text-neutral-700">
                        <div>{req.startDate}</div>
                        <div className="text-xs text-neutral-500">au {req.endDate}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-900">{req.days}</td>
                      <td className="py-3 px-4">{statusPill(req.status)}</td>
                      <td className="py-3 px-4 text-neutral-600">{req.reason}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(req.id, 'REFUSED')}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            Refuser
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateStatus(req.id, 'APPROVED')}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Approuver
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
