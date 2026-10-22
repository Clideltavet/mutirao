'use client'

import { useEffect, useRef } from 'react'
import { acceptSequence } from './sequenceState'
import { collections, mergeCollection, canonical } from './syncMerge'
import { SYNC_KEYS, safeRead } from './syncUtils'

function stamp(items, kind) {
  if (!Array.isArray(items)) return { next: [], changed: false }
  let changed = false
  const now = new Date().toISOString()

  const next = items.map(item => {
    if (!item || typeof item !== 'object' || kind === 'audit') return item
    if (item._syncUpdatedAt) return item
    changed = true
    return {
      ...item,
      _syncUpdatedAt:
        item.updatedAt ||
        item.deliveredAt ||
        item.dischargedAt ||
        item.confirmedAt ||
        item.createdAt ||
        now,
    }
  })

  return { next, changed }
}

function readSnapshot() {
  const patients = stamp(safeRead(SYNC_KEYS.patients, []), 'patients')
  const clients = stamp(safeRead(SYNC_KEYS.clients, []), 'clients')
  const procedures = stamp(safeRead(SYNC_KEYS.procedures, []), 'procedures')
  const auditLog = safeRead(SYNC_KEYS.audit, [])

  if (patients.changed) localStorage.setItem(SYNC_KEYS.patients, JSON.stringify(patients.next))
  if (clients.changed) localStorage.setItem(SYNC_KEYS.clients, JSON.stringify(clients.next))
  if (procedures.changed) localStorage.setItem(SYNC_KEYS.procedures, JSON.stringify(procedures.next))

  return {
    patients: patients.next,
    clients: clients.next,
    procedures: procedures.next,
    auditLog,
    nextPatientNumber: Number(localStorage.getItem('deltaVetNextPatientNumber') || 1),
    deletions: safeRead('deltaVetSyncDeletes', []),
  }
}

function applyRemote(data, snapshot) {
  const pending = safeRead('deltaVetSyncDeletes', [])
  const confirmed = data.deletions || []
  for (const [field, kind, storageKey, key] of collections) {
    if (!Array.isArray(data[field])) continue
    const deleted = [...confirmed, ...pending].filter(d => d.kind === kind).map(d => d.recordKey)
    const merged = mergeCollection(data[field], safeRead(storageKey, []), snapshot[field] || [], key, deleted)
    localStorage.setItem(storageKey, JSON.stringify(merged))
  }
  // Acknowledge only deletions actually present on the server, never a new
  // deletion queued while this request was in flight.
  localStorage.setItem('deltaVetSyncDeletes', JSON.stringify(pending.filter(d =>
    !confirmed.some(c => c.kind === d.kind && c.recordKey === d.recordKey))))
  acceptSequence(data)
  localStorage.setItem('deltaVetLastNeonSync', data.syncedAt)
  window.dispatchEvent(new CustomEvent('deltaVetRemoteSync', { detail: data }))
  let pendingCount = safeRead('deltaVetSyncDeletes', []).length
  for (const [field, , storageKey, key] of collections) {
    const remote = new Map((data[field] || []).map(p => [key(p), canonical(p)]))
    pendingCount += safeRead(storageKey, []).filter(p => remote.get(key(p)) !== canonical(p)).length
  }
  pendingCount += Object.keys(localStorage).filter(k => k.startsWith('deltaVetPendingEntry:')).length
  return pendingCount
}

export default function SharedDataSync() {
  const syncing = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    async function sync({ manual = false } = {}) {
      if (syncing.current) {
        if (manual) {
          window.dispatchEvent(new CustomEvent('deltaVetSyncResult', {
            detail: { ok: false, busy: true, error: 'Já existe uma sincronização em andamento.' }
          }))
        }
        return
      }

      syncing.current = true

      {
        window.dispatchEvent(new CustomEvent('deltaVetSyncState', {
          detail: { syncing: true }
        }))
      }

      try {
        const snapshot = readSnapshot()

        const response = await fetch('/api/sync/shared', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        })

        const data = await response.json().catch(() => null)

        if (!response.ok || !data) {
          const errorMessage = data?.error || `Falha ao sincronizar com o Neon (${response.status}).`
          window.dispatchEvent(new CustomEvent('deltaVetSyncResult', {
            detail: { ok: false, error: errorMessage }
          }))
          return
        }

        const pendingCount = mounted.current ? applyRemote(data, snapshot) : 0

        const result = {
          ok: true,
          pendingCount,
          syncedAt: data.syncedAt || new Date().toISOString(),
          counts: {
            patients: Array.isArray(data.patients) ? data.patients.length : 0,
            clients: Array.isArray(data.clients) ? data.clients.length : 0,
            procedures: Array.isArray(data.procedures) ? data.procedures.length : 0,
            audit: Array.isArray(data.auditLog) ? data.auditLog.length : 0,
          },
        }

        localStorage.setItem('deltaVetLastSyncResult', JSON.stringify(result))
        window.dispatchEvent(new CustomEvent('deltaVetSyncResult', { detail: result }))
      } catch (error) {
        window.dispatchEvent(new CustomEvent('deltaVetSyncResult', {
          detail: { ok: false, error: error?.message || 'Não foi possível conectar ao Neon.' }
        }))
      } finally {
        syncing.current = false
        {
          window.dispatchEvent(new CustomEvent('deltaVetSyncState', {
            detail: { syncing: false }
          }))
        }
      }
    }

    const onManualSync = () => sync({ manual: true })
    const onOnline = () => sync()
    const onFocus = () => sync()

    sync()
    const timer = setInterval(() => sync(), 1800)

    window.addEventListener('deltaVetManualSyncRequest', onManualSync)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)

    return () => {
      mounted.current = false
      clearInterval(timer)
      window.removeEventListener('deltaVetManualSyncRequest', onManualSync)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return null
}
