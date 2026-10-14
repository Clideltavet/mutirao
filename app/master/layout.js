'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clearAdminSession, meApi, setAdminSession } from '../../components/authUtils'

export default function MasterLayout({ children }) {
  const path = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    async function validate() {
      if (path === '/master/login') {
        if (active) setReady(true)
        return
      }

      const user = await meApi()
      if (!active) return

      if (!user || !user.accesses?.includes('MASTER')) {
        clearAdminSession()
        router.replace('/master/login')
        return
      }

      setAdminSession(user)
      setReady(true)
    }

    setReady(false)
    validate()
    return () => { active = false }
  }, [path, router])

  return ready ? children : <div className="auth-loading">Carregando...</div>
}
