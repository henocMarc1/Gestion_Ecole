'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HREmployeesPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/dashboard/hr')
  }, [router])
  
  return null
}
