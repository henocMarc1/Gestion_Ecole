'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardIndexPage() {
  const router = useRouter()
  const { isAuthenticated, user, redirectToDashboard } = useAuth()

  useEffect(() => {
    if (isAuthenticated && user) {
      redirectToDashboard()
    } else if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, user, redirectToDashboard, router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-neutral-600">
      Redirection en cours...
    </div>
  )
}
