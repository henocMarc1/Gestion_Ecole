'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { Icons } from '@/components/ui/Icons'

interface NotificationRecipient {
  id: string
  notification_id: string
  delivered_at: string | null
  read_at: string | null
  clicked_at: string | null
  status: string
  notifications: {
    id: string
    title: string
    message: string
    notification_type: string
    priority: string
    sent_at: string
    created_at: string
  }
}

export default function UserNotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRecipient[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Real-time subscription
  useRealtimeSubscription({
    table: 'notification_recipients',
    filter: `user_id=eq.${user?.id}`,
    onInsert: (newRecipient) => {
      fetchNotifications()
    },
    onUpdate: (updatedRecipient) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === updatedRecipient.id ? { ...n, ...updatedRecipient } : n))
      )
    },
    onDelete: (deletedRecipient) => {
      setNotifications((prev) => prev.filter((n) => n.id !== deletedRecipient.id))
    }
  })

  useEffect(() => {
    if (user?.id) {
      fetchNotifications()
    }
  }, [user])

  async function fetchNotifications() {
    if (!user?.id) return

    setIsLoading(true)

    const { data, error } = await supabase
      .from('notification_recipients')
      .select(`
        *,
        notifications (
          id,
          title,
          message,
          notification_type,
          priority,
          sent_at,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setNotifications(data as NotificationRecipient[])
    }

    setIsLoading(false)
  }

  async function markAsRead(recipientId: string) {
    try {
      const { error } = await supabase
        .from('notification_recipients')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', recipientId)

      if (error) throw error

      fetchNotifications()
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      const unreadIds = filteredNotifications
        .filter((n) => !n.read_at)
        .map((n) => n.id)

      if (unreadIds.length === 0) return

      const { error } = await supabase
        .from('notification_recipients')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .in('id', unreadIds)

      if (error) throw error

      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at
    if (filter === 'read') return !!n.read_at
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const getTypeIcon = (type: string) => {
    const icons = {
      info: <Icons.Info className="h-5 w-5 text-blue-600" />,
      alert: <Icons.AlertCircle className="h-5 w-5 text-orange-600" />,
      reminder: <Icons.Clock className="h-5 w-5 text-purple-600" />,
      announcement: <Icons.Bell className="h-5 w-5 text-green-600" />,
      urgent: <Icons.AlertTriangle className="h-5 w-5 text-red-600" />
    }
    return icons[type as keyof typeof icons] || icons.info
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
          <h1 className="text-3xl font-bold text-gray-900">Mes Notifications</h1>
          <p className="text-gray-600 mt-1">
            {unreadCount > 0 ? (
              <span className="font-medium text-blue-600">
                {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            ) : (
              'Aucune notification non lue'
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Icons.Check className="h-4 w-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Toutes ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Non lues ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 rounded-lg font-medium ${
            filter === 'read'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Lues ({notifications.length - unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Icons.Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucune notification</p>
          </div>
        ) : (
          filteredNotifications.map((recipient) => {
            const notification = recipient.notifications
            const isUnread = !recipient.read_at

            return (
              <div
                key={recipient.id}
                onClick={() => isUnread && markAsRead(recipient.id)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition hover:shadow-md ${
                  isUnread ? 'border-l-4 border-blue-600' : 'border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg ${
                      isUnread ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                  >
                    {getTypeIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3
                          className={`font-semibold ${
                            isUnread ? 'text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadge(
                              notification.priority
                            )}`}
                          >
                            {notification.priority}
                          </span>
                          <span className="text-xs text-gray-500">
                            <Icons.Calendar className="inline h-3 w-3 mr-1" />
                            {new Date(notification.sent_at || notification.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {isUnread && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>

                    <p
                      className={`text-sm ${
                        isUnread ? 'text-gray-700' : 'text-gray-500'
                      } whitespace-pre-wrap`}
                    >
                      {notification.message}
                    </p>

                    {recipient.read_at && (
                      <div className="mt-2 text-xs text-gray-400">
                        Lu le {new Date(recipient.read_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
