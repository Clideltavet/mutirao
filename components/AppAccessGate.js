'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getTabletSession } from './authUtils'

function needed(path) {
  if (path.startsWith('/entrada')) return 'ENTRADA'
  if (path.startsWith('/pacientes')) return 'PACIENTES'
  if (path.startsWith('/saida')) return 'SAIDA'
  if (path.startsWith('/recepcao')) return 'RECEPCAO'
  return null
}

export default function AppAccessGate({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (pathname.startsWith('/cirurgia') || pathname.startsWith('/master') || pathname === '/') {
      setReady(true)
      return
    }
    const session = getTabletSession()
    if (!session) return router.replace('/')
    const access = needed(pathname)
    if (access && !session.accesses?.includes(access)) return router.replace('/')
    setReady(true)
  }, [pathname, router])

  return ready ? children : <div className="auth-loading">Carregando...</div>
}
