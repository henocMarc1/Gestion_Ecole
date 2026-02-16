'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { Icons } from '@/components/ui/Icons'
import { UserSelector } from '@/components/notifications/UserSelector'
import { ReadTrackingModal } from '@/components/notifications/ReadTrackingModal'

interface Class {
  id: string
  name: string
}

interface Notification {
  id: string
  title: string
  message: string
  notification_type: string
  target_type: string
  target_class_id: string | null
  priority: string
  scheduled_at: string | null
  sent_at: string | null
  status: string
  created_at: string
  recipient_count?: number
  read_count?: number
}

interface User {
  id: string
  full_name: string
  email: string
  role: string
}

type TargetType = 'all' | 'parents' | 'employees' | 'teachers' | 'class' | 'custom'
type NotificationType = 'info' | 'alert' | 'reminder' | 'announcement' | 'urgent'
type Priority = 'low' | 'normal' | 'high' | 'urgent'

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showReadTracking, setShowReadTracking] = useState(false)
  const [trackingNotificationId, setTrackingNotificationId] = useState<string | null>(null)
  
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    notification_type: 'info' as NotificationType,
    target_type: 'all' as TargetType,
    target_class_id: '',
    priority: 'normal' as Priority,
    scheduled_at: ''
  })

  // Real-time subscription
  useRealtimeSubscription({
    table: 'notifications',
    onInsert: (newNotification) => {
      setNotifications((prev) => [newNotification, ...prev])
    },
    onUpdate: (updatedNotification) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
      )
    },
    onDelete: (deletedNotification) => {
      setNotifications((prev) => prev.filter((n) => n.id !== deletedNotification.id))
    }
  })

  useEffect(() => {
    fetchData()
  }, [user])

  async function fetchData() {
    if (!user?.id) return

    setIsLoading(true)

    // Get user's school_id
    const { data: userData } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single()

    const schoolId = userData?.school_id

    // Fetch notifications
    const { data: notificationsData } = await supabase
      .from('notifications')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    // Fetch classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('name')

    // Fetch users for custom targeting
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('school_id', schoolId)
      .order('full_name')

    // Get recipient counts for each notification
    if (notificationsData) {
      const notificationsWithCounts = await Promise.all(
        notificationsData.map(async (notification) => {
          const { count: totalCount } = await supabase
            .from('notification_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('notification_id', notification.id)

          const { count: readCount } = await supabase
            .from('notification_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('notification_id', notification.id)
            .eq('status', 'read')

          return {
            ...notification,
            recipient_count: totalCount || 0,
            read_count: readCount || 0
          }
        })
      )
      setNotifications(notificationsWithCounts)
    }

    setClasses(classesData || [])
    setUsers(usersData || [])
    setIsLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!user?.id) return

    try {
      // Get school_id
      const { data: userData } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single()

      const schoolId = userData?.school_id

      // Create notification
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          school_id: schoolId,
          title: notificationForm.title,
          message: notificationForm.message,
          notification_type: notificationForm.notification_type,
          target_type: notificationForm.target_type,
          target_class_id: notificationForm.target_class_id || null,
          priority: notificationForm.priority,
          scheduled_at: notificationForm.scheduled_at || null,
          status: notificationForm.scheduled_at ? 'scheduled' : 'draft',
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // If custom targeting, create recipients manually
      if (notificationForm.target_type === 'custom' && selectedUsers.length > 0 && notification) {
        const recipients = selectedUsers.map((userId) => ({
          notification_id: notification.id,
          user_id: userId,
          status: 'unread',
          read_at: null,
          created_at: new Date().toISOString()
        }))

        await supabase.from('notification_recipients').insert(recipients)
      }

      // Reset form
      setNotificationForm({
        title: '',
        message: '',
        notification_type: 'info',
        target_type: 'all',
        target_class_id: '',
        priority: 'normal',
        scheduled_at: ''
      })
      setSelectedUsers([])
      setShowModal(false)

      alert('Notification créée avec succès')
      fetchData()
    } catch (error) {
      console.error('Error creating notification:', error)
      alert('Erreur lors de la création de la notification')
    }
  }

  async function sendNotification(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'sent' })
        .eq('id', notificationId)

      if (error) throw error

      alert('Notification envoyée avec succès')
      fetchData()
    } catch (error) {
      console.error('Error sending notification:', error)
      alert('Erreur lors de l\'envoi de la notification')
    }
  }

  async function deleteNotification(notificationId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) return

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error

      fetchData()
    } catch (error) {
      console.error('Error deleting notification:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700'
    }
    return badges[status as keyof typeof badges] || badges.draft
  }

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: 'bg-gray-100 text-gray-600',
      normal: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600'
    }
    return badges[priority as keyof typeof badges] || badges.normal
  }

  const filteredUsers = users.filter((u) => {
    if (notificationForm.target_type === 'parents') return u.role === 'PARENT'
    if (notificationForm.target_type === 'employees')
      return ['TEACHER', 'HR', 'SECRETARY', 'ACCOUNTANT', 'ADMIN'].includes(u.role)
    if (notificationForm.target_type === 'teachers') return u.role === 'TEACHER'
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications Push</h1>
          <p className="text-gray-600 mt-1">Envoyez des notifications ciblées aux parents et employés</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Icons.Bell className="h-4 w-4" />
          Nouvelle Notification
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-blue-600">Total Notifications</div>
              <div className="text-2xl font-bold text-blue-700 mt-1">{notifications.length}</div>
            </div>
            <Icons.Bell className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-600">Envoyées</div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {notifications.filter((n) => n.status === 'sent').length}
              </div>
            </div>
            <Icons.CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-orange-600">Programmées</div>
              <div className="text-2xl font-bold text-orange-700 mt-1">
                {notifications.filter((n) => n.status === 'scheduled').length}
              </div>
            </div>
            <Icons.Clock className="h-8 w-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Brouillons</div>
              <div className="text-2xl font-bold text-gray-700 mt-1">
                {notifications.filter((n) => n.status === 'draft').length}
              </div>
            </div>
            <Icons.AlertCircle className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique des Notifications</h2>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucune notification</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(
                            notification.status
                          )}`}
                        >
                          {notification.status}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadge(
                            notification.priority
                          )}`}
                        >
                          {notification.priority}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          {notification.target_type}
                        </span>
                      </div>

                      <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>
                          <Icons.Users className="inline h-3 w-3 mr-1" />
                          {notification.recipient_count || 0} destinataires
                        </span>
                        {notification.read_count !== undefined && (
                          <span>
                            <Icons.CheckCircle className="inline h-3 w-3 mr-1" />
                            {notification.read_count} lus
                          </span>
                        )}
                        <span>
                          <Icons.Calendar className="inline h-3 w-3 mr-1" />
                          {new Date(notification.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {notification.status === 'sent' && (
                        <button
                          onClick={() => {
                            setTrackingNotificationId(notification.id)
                            setShowReadTracking(true)
                          }}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center gap-2"
                          title="Voir qui a lu"
                        >
                          <Icons.Eye className="h-4 w-4" />
                          <span className="text-xs">
                            {notification.read_count || 0}/{notification.recipient_count || 0}
                          </span>
                        </button>
                      )}
                      {notification.status === 'draft' && (
                        <button
                          onClick={() => sendNotification(notification.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          <Icons.Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        <Icons.X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nouvelle Notification</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  required
                  value={notificationForm.title}
                  onChange={(e) =>
                    setNotificationForm({ ...notificationForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Titre de la notification"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={notificationForm.message}
                  onChange={(e) =>
                    setNotificationForm({ ...notificationForm, message: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Contenu du message"
                />
              </div>

              {/* Type and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={notificationForm.notification_type}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        notification_type: e.target.value as NotificationType
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="info">Info</option>
                    <option value="alert">Alerte</option>
                    <option value="reminder">Rappel</option>
                    <option value="announcement">Annonce</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                  <select
                    value={notificationForm.priority}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        priority: e.target.value as Priority
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Faible</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Target Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destinataires
                </label>
                <select
                  value={notificationForm.target_type}
                  onChange={(e) =>
                    setNotificationForm({
                      ...notificationForm,
                      target_type: e.target.value as TargetType
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous</option>
                  <option value="parents">Tous les Parents</option>
                  <option value="employees">Tous les Employés</option>
                  <option value="teachers">Tous les Enseignants</option>
                  <option value="class">Une Classe Spécifique</option>
                  <option value="custom">Sélection Personnalisée</option>
                </select>
              </div>

              {/* Class Selection */}
              {notificationForm.target_type === 'class' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
                  <select
                    value={notificationForm.target_class_id}
                    onChange={(e) =>
                      setNotificationForm({ ...notificationForm, target_class_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner une classe</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom User Selection */}
              {notificationForm.target_type === 'custom' && (
                <UserSelector
                  users={filteredUsers}
                  selectedUsers={selectedUsers}
                  onSelectionChange={setSelectedUsers}
                  className="mt-2"
                />
              )}

              {/* Scheduled Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Programmer (optionnel)
                </label>
                <input
                  type="datetime-local"
                  value={notificationForm.scheduled_at}
                  onChange={(e) =>
                    setNotificationForm({ ...notificationForm, scheduled_at: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Créer Notification
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read Tracking Modal */}
      {showReadTracking && trackingNotificationId && (
        <ReadTrackingModal
          notificationId={trackingNotificationId}
          onClose={() => {
            setShowReadTracking(false)
            setTrackingNotificationId(null)
          }}
        />
      )}
    </div>
  )
}
