'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Icons } from '@/components/ui/Icons'

interface NotificationReader {
  user_id: string
  full_name: string
  email: string
  role: string
  is_read: boolean
  read_at: string | null
  read_from_device: string | null
  read_status: string
  minutes_to_read: number | null
}

interface NotificationStats {
  id: string
  title: string
  sent_at: string
  total_recipients: number
  read_count: number
  read_percentage: number
  first_read_at: string | null
  last_read_at: string | null
}

interface ReadTrackingModalProps {
  notificationId: string
  onClose: () => void
}

export function ReadTrackingModal({ notificationId, onClose }: ReadTrackingModalProps) {
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [readers, setReaders] = useState<NotificationReader[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | 'read' | 'unread'>('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadData()

    // Subscription pour les mises à jour en temps réel
    const channel = supabase
      .channel('notification-reads')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_recipients',
          filter: `notification_id=eq.${notificationId}`
        },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [notificationId])

  const loadData = async () => {
    try {
      // Charger les statistiques
      const { data: statsData } = await supabase
        .from('notification_read_stats')
        .select('*')
        .eq('id', notificationId)
        .single()

      if (statsData) {
        setStats(statsData)
      }

      // Charger les détails des lecteurs
      const { data: readersData } = await supabase
        .from('notification_readers_detail')
        .select('*')
        .eq('id', notificationId)
        .order('read_at', { ascending: false, nullsFirst: false })

      if (readersData) {
        setReaders(readersData)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredReaders = readers.filter((reader) => {
    if (filterStatus === 'read') return reader.is_read
    if (filterStatus === 'unread') return !reader.is_read
    return true
  })

  const exportToCSV = () => {
    const headers = ['Nom', 'Email', 'Rôle', 'Statut', 'Date de lecture', 'Appareil', 'Temps de lecture (min)']
    const rows = readers.map((r) => [
      r.full_name,
      r.email,
      r.role,
      r.read_status,
      r.read_at ? new Date(r.read_at).toLocaleString('fr-FR') : 'Non lu',
      r.read_from_device || 'N/A',
      r.minutes_to_read?.toFixed(1) || 'N/A'
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `notification_${notificationId}_tracking.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-8">
          <Icons.Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{stats.title}</h2>
              <p className="text-sm text-gray-500">
                Envoyée le {new Date(stats.sent_at).toLocaleString('fr-FR')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Icons.X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icons.Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_recipients}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Icons.CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lues</p>
                  <p className="text-2xl font-bold text-green-600">{stats.read_count}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Icons.AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Non lues</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.total_recipients - stats.read_count}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Icons.TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Taux</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.read_percentage.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progression de lecture</span>
              <span className="text-sm text-gray-500">{stats.read_percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.read_percentage}%` }}
              />
            </div>
          </div>

          {/* Reading Times */}
          {stats.first_read_at && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-sm">
                <span className="text-gray-600">Première lecture: </span>
                <span className="font-medium text-gray-900">
                  {new Date(stats.first_read_at).toLocaleString('fr-FR')}
                </span>
              </div>
              {stats.last_read_at && (
                <div className="text-sm">
                  <span className="text-gray-600">Dernière lecture: </span>
                  <span className="font-medium text-gray-900">
                    {new Date(stats.last_read_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters and Actions */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({readers.length})
            </button>
            <button
              onClick={() => setFilterStatus('read')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'read'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Lues ({readers.filter((r) => r.is_read).length})
            </button>
            <button
              onClick={() => setFilterStatus('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'unread'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Non lues ({readers.filter((r) => !r.is_read).length})
            </button>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Icons.Download className="h-4 w-4" />
            Exporter CSV
          </button>
        </div>

        {/* Readers List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredReaders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icons.Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Aucun utilisateur dans cette catégorie</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReaders.map((reader) => (
                <div
                  key={reader.user_id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    reader.is_read
                      ? 'border-green-200 bg-green-50'
                      : reader.read_status === 'Non lu (24h+)'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`p-2 rounded-full ${
                          reader.is_read ? 'bg-green-100' : 'bg-gray-100'
                        }`}
                      >
                        {reader.is_read ? (
                          <Icons.CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Icons.Circle className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{reader.full_name}</h4>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              reader.role === 'PARENT'
                                ? 'bg-purple-100 text-purple-700'
                                : reader.role === 'TEACHER'
                                ? 'bg-green-100 text-green-700'
                                : reader.role === 'ADMIN'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {reader.role}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{reader.email}</p>
                        {reader.is_read && reader.read_at && (
                          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Icons.Clock className="h-3 w-3" />
                              {new Date(reader.read_at).toLocaleString('fr-FR')}
                            </span>
                            {reader.read_from_device && (
                              <span className="flex items-center gap-1">
                                <Icons.Monitor className="h-3 w-3" />
                                {reader.read_from_device}
                              </span>
                            )}
                            {reader.minutes_to_read !== null && (
                              <span className="flex items-center gap-1">
                                <Icons.TrendingUp className="h-3 w-3" />
                                Lu en {reader.minutes_to_read.toFixed(0)} min
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        reader.read_status === 'Lu'
                          ? 'bg-green-100 text-green-700'
                          : reader.read_status === 'Non lu (24h+)'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {reader.read_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
