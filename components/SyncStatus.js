'use client'

import { useEffect, useState } from 'react'

export default function SyncStatus() {
  const [last, setLast] = useState(null)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine)
      setLast(localStorage.getItem('deltaVetLastNeonSync'))
    }
    refresh()
    const timer = setInterval(refresh, 1500)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])

  const synced = online && !!last

  return (
    <span className={`delta-sync-pill ${synced ? 'is-synced' : 'is-local'}`}>
      <span className="delta-sync-dot" />
      {synced ? 'NEON SINCRONIZADO' : online ? 'SINCRONIZANDO...' : 'MODO LOCAL'}
    </span>
  )
}
