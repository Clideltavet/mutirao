export const SYNC_KEYS = {
  patients: 'deltaVetPatients',
  clients: 'deltaVetClients',
  procedures: 'deltaVetProcedures',
  audit: 'deltaVetAuditLog',
}

export function safeRead(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

export function patientRecordKey(patient) {
  if (patient?.id) return String(patient.id)
  return `${patient?.number ?? 'sem-ficha'}::${patient?.createdAt || 'sem-data'}`
}

export function clientRecordKey(client) {
  if (client?.id) return String(client.id)
  const cpf = String(client?.cpf || '').replace(/\D/g, '')
  if (cpf) return `cpf:${cpf}`
  const phone = String(client?.phone || '').replace(/\D/g, '')
  if (phone) return `phone:${phone}`
  return `name:${String(client?.name || '').trim().toLowerCase()}`
}

export function procedureRecordKey(item) {
  return String(item?.id || item?.name || '').trim().toLowerCase()
}

export function auditRecordKey(item) {
  return String(item?.id || `${item?.at || ''}:${item?.action || ''}:${item?.patientNumber ?? ''}`)
}

export function queueSyncDelete(kind, recordKey) {
  if (!kind || !recordKey) return
  const current = safeRead('deltaVetSyncDeletes', [])
  const id = `${kind}:${recordKey}`
  if (!current.some(item => `${item.kind}:${item.recordKey}` === id)) {
    current.push({ kind, recordKey, at: new Date().toISOString() })
    localStorage.setItem('deltaVetSyncDeletes', JSON.stringify(current))
  }
}

export function clearSyncDeletes() {
  localStorage.setItem('deltaVetSyncDeletes', '[]')
}

export function patientRouteId(patient) {
  return encodeURIComponent(patientRecordKey(patient))
}
export function matchesPatientRoute(patient, route) {
  // Legacy numeric links remain readable; new links always use stable identity.
  return patientRecordKey(patient) === route || (!route.includes('::') && /^\d+$/.test(route) && String(patient.number) === route)
}
