import { patientRecordKey, clientRecordKey, procedureRecordKey, auditRecordKey } from './syncUtils.js'
export const collections = [
  ['patients','patients','deltaVetPatients',patientRecordKey],
  ['clients','clients','deltaVetClients',clientRecordKey],
  ['procedures','procedures','deltaVetProcedures',procedureRecordKey],
  ['auditLog','audit','deltaVetAuditLog',auditRecordKey],
]
export function mergeCollection(remote, current, sent, key, deleted) {
  const before = new Map(sent.map(p => [key(p), JSON.stringify(p)]))
  const merged = new Map(remote.map(p => [key(p), p]))
  for (const p of current) {
    const id = key(p)
    // Keep records missing remotely and any edits made while fetch was in flight.
    if (!merged.has(id) || before.get(id) !== JSON.stringify(p)) merged.set(id,p)
  }
  for (const id of deleted) merged.delete(id)
  return [...merged.values()]
}

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}'
  return JSON.stringify(value)
}
