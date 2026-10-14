'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAdminSession } from '../../components/authUtils'

export default function MasterLayout({ children }) {
  const path = usePathname(), router = useRouter()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (path === '/master/login') return setReady(true)
    if (!getAdminSession()) return router.replace('/master/login')
    setReady(true)
  }, [path, router])
  return ready ? children : <div className="auth-loading">Carregando...</div>
}
