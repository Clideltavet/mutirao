'use client'

import { useEffect, useMemo, useState } from 'react'

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

export default function SyncStatus({ compact = false }) {
  const [last, setLast] = useState(null)
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine)
      setLast(localStorage.getItem('deltaVetLastNeonSync'))
    }

    const onState = event => {
      // Polling stays silent after the first confirmed connection. Keep any
      // error visible until a request actually succeeds.
      if (event.detail?.syncing && !event.detail?.manual && localStorage.getItem('deltaVetLastNeonSync')) return
      setSyncing(!!event.detail?.syncing)
      if (event.detail?.syncing) {
        setError(false)
        setMessage('Sincronizando com o Neon...')
      }
    }

    const onResult = event => {
      const detail = event.detail || {}
      if (detail.busy) return
      setSyncing(false)
      if (detail.ok) {
        setError(false)
        setPending(detail.pendingCount || 0)
        setLast(detail.syncedAt || localStorage.getItem('deltaVetLastNeonSync'))
        setMessage(detail.pendingCount ? `${detail.pendingCount} pendência(s) local(is). Retome entradas pendentes ou entre com a permissão necessária para enviá-las.` : `Sincronizado com sucesso${detail.counts ? ` • ${detail.counts.patients} paciente(s)` : ''}`)
      } else if (!detail.busy) {
        setError(true)
        setMessage(detail.error || 'Erro ao sincronizar com o Neon.')
      }
    }

    refresh()
    const timer = setInterval(refresh, 1500)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    window.addEventListener('deltaVetSyncState', onState)
    window.addEventListener('deltaVetSyncResult', onResult)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('deltaVetSyncState', onState)
      window.removeEventListener('deltaVetSyncResult', onResult)
    }
  }, [])

  const state = useMemo(() => {
    if (!online) return 'offline'
    if (syncing) return 'syncing'
    if (error) return 'error'
    if (last) return 'synced'
    return 'waiting'
  }, [online, syncing, error, last])

  function manualSync() {
    if (!online) {
      setError(true)
      setMessage('Sem internet. Não foi possível sincronizar.')
      return
    }
    setError(false)
    setMessage('Sincronizando com o Neon...')
    setSyncing(true)
    window.dispatchEvent(new CustomEvent('deltaVetManualSyncRequest'))
  }

  const label =
    state === 'syncing' ? 'SINCRONIZANDO...' :
    state === 'synced' ? 'SINCRONIZAR NEON' :
    state === 'error' ? 'TENTAR NOVAMENTE' :
    state === 'offline' ? 'SEM INTERNET' :
    'SINCRONIZAR NEON'

  return (
    <div className={`delta-sync-control ${compact ? 'is-compact' : ''}`}>
      <button
        type="button"
        className={`delta-sync-button state-${state}`}
        onClick={manualSync}
        disabled={syncing || !online}
      >
        <span className="delta-sync-button-icon">{syncing ? '↻' : '⟳'}</span>
        <span>{label}</span>
      </button>

      {!compact && (
        <div className={`delta-sync-feedback ${error ? 'has-error' : ''}`}>
          <div>
            <span className="delta-sync-feedback-dot" />
            <strong>
              {!online ? 'Sem internet / modo local' : syncing ? 'Sincronizando...' : error ? 'Falha na sincronização' : pending ? 'Neon conectado • pendências locais' : last ? 'Neon sincronizado' : 'Aguardando sincronização'}
            </strong>
          </div>
          <small>
            {message || 'Sincronização automática ativa.'}{last ? ` • Última confirmação: ${formatTime(last)}` : ''}
          </small>
        </div>
      )}
    </div>
  )
}
