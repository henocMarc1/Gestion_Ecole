'use client'

import { useCallback, useEffect, useState } from 'react'
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

export default function EmployeeLeavesPage() {
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [hasEmployeeRecord, setHasEmployeeRecord] = useState(true)
  const [newRequest, setNewRequest] = useState({
    type: 'Congé payé' as LeaveRequest['type'],
    startDate: '',
    endDate: '',
    reason: '',
  })

  const computeDays = (start: string, end: string) => {
    if (!start || !end) return 0
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diff = Math.max(0, endDate.getTime() - startDate.getTime())
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  }

  const loadMyRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMyRequests([])
        setCurrentUser(null)
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, role, school_id')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      setCurrentUser(userData as CurrentUser)

      // Récupérer l'employee_id de l'utilisateur
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (empError) {
        console.warn('Pas d\'enregistrement employee trouvé:', empError)
        setHasEmployeeRecord(false)
        setMyRequests([])
        toast.info('Profil employé non configuré. Veuillez contacter l\'administration.')
        return
      }

      if (!employeeData) {
        console.warn('Employee data vide pour user:', user.id)
        setHasEmployeeRecord(false)
        setMyRequests([])
        toast.info('Profil employé non trouvé. Veuillez contacter l\'administration.')
        return
      }
      
      setHasEmployeeRecord(true)

      const { data, error } = await supabase
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
          school_id
        `)
        .eq('employee_id', employeeData.id)
        .order('start_date', { ascending: false })

      if (error) throw error

      // Mapper les types et statuts pour correspondre à ce que l'app attend
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

      const mapped: LeaveRequest[] = (data || []).map(item => ({
        id: item.id,
        staffName: userData?.full_name || 'Utilisateur',
        role: userData?.role || 'EMPLOYEE',
        type: typeMap[item.leave_type] || 'Congé payé',
        startDate: item.start_date,
        endDate: item.end_date,
        days: item.total_days || computeDays(item.start_date, item.end_date),
        status: statusMap[item.status] || 'PENDING',
        reason: item.reason || '',
      }))

      setMyRequests(mapped)
    } catch (err) {
      console.error('Erreur chargement mes congés', err)
      toast.error('Impossible de charger vos demandes.')
      setMyRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMyRequests()
  }, [loadMyRequests])

  const handleRealtimeUpdate = useCallback(() => {
    loadMyRequests()
  }, [loadMyRequests])

  useRealtimeSubscription({
    table: 'leave_requests',
    event: '*',
    onData: handleRealtimeUpdate,
    enabled: true,
  })

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

    if (!currentUser?.school_id) {
      toast.error('Informations d\'école manquantes')
      return
    }

    try {
      // Récupérer l'employee_id
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

      if (empError || !employeeData) {
        console.error('Profil employé non trouvé:', empError)
        toast.error('Profil employé non configuré. Veuillez contacter l\'administration.')
        return
      }

      // Mapper les types de congés
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

      const { error } = await supabase.from('leave_requests').insert([payload])
      if (error) throw error
      toast.success('Demande envoyée au RH')
      setNewRequest({ type: 'Congé payé', startDate: '', endDate: '', reason: '' })
      await loadMyRequests()
    } catch (err) {
      console.error('Erreur création congé', err)
      toast.error('Envoi impossible')
    }
  }

  const statusPill = (status: LeaveStatus) => {
    const map: Record<LeaveStatus, { color: string; label: string; icon: any }> = {
      PENDING: { color: 'bg-amber-100 text-amber-700', label: 'En attente', icon: Icons.Activity },
      APPROVED: { color: 'bg-emerald-100 text-emerald-700', label: 'Approuvé', icon: Icons.Check },
      REFUSED: { color: 'bg-red-100 text-red-700', label: 'Refusé', icon: Icons.X },
    }
    const cfg = map[status]
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
        <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-orange-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <p className="text-xs font-semibold text-orange-600 uppercase">Mes demandes</p>
          <h1 className="text-3xl font-semibold text-neutral-900">Gestion des congés</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Déposez une demande et suivez l'approbation du RH.
          </p>
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
                <h2 className="text-lg font-semibold text-neutral-900">Déposer une demande</h2>
                <span className="text-sm text-neutral-500">Validée par le RH</span>
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
                  <Icons.Plus className="w-4 h-4 mr-2" /> Soumettre
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="border border-neutral-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Mes demandes</h2>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-neutral-500">Chargement...</div>
          ) : myRequests.length === 0 ? (
            <div className="py-8 text-center">
              <Icons.Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 font-medium">Aucune demande</p>
              <p className="text-sm text-neutral-500 mt-1">Déposez votre première demande ci-dessus</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map(req => (
                <div key={req.id} className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-neutral-900">{req.type}</p>
                        {statusPill(req.status)}
                      </div>
                      <div className="text-sm text-neutral-600 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-neutral-500">Période</span>
                          <p>
                            {req.startDate} → {req.endDate}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-neutral-500">Durée</span>
                          <p>{req.days} jour{req.days > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {req.reason && (
                        <p className="text-xs text-neutral-500 mt-2">
                          <span className="font-medium">Motif:</span> {req.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">
                        {req.status === 'PENDING' && '⏳ En attente de validation'}
                        {req.status === 'APPROVED' && '✓ Approuvé'}
                        {req.status === 'REFUSED' && '✗ Refusé'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
