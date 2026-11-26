'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clearTabletSession, meApi, setTabletSession } from './authUtils'

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
    let active = true

    async function validate() {
      if (pathname.startsWith('/cirurgia') || pathname.startsWith('/master') || pathname === '/') {
        if (active) setReady(true)
        return
      }

      const user = await meApi()
      if (!active) return

      if (!user) {
        clearTabletSession()
        router.replace('/')
        return
      }

      setTabletSession(user)

      const access = needed(pathname)
      if (access && !user.accesses?.includes(access)) {
        router.replace('/')
        return
      }

      setReady(true)
    }

    setReady(false)
    validate()

    return () => { active = false }
  }, [pathname, router])

  return ready ? children : <div className="auth-loading">Carregando...</div>
}
