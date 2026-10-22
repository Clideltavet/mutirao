// Server revision orders configuration changes as well as allocations.
// A deliberate admin reset is accepted only with a newer revision.
export function chooseSequence(current, incoming) {
  const value = Number(incoming?.nextPatientNumber)
  const revision = Number(incoming?.sequenceRevision)
  if (!Number.isSafeInteger(value) || value < 1 || !Number.isSafeInteger(revision)) return current
  if (current && revision < current.revision) return current
  if (current && revision === current.revision) return { ...current, value: Math.max(current.value, value) }
  return { value, revision, epoch: incoming.sequenceEpoch }
}
export function acceptSequence(data) {
  let current = null
  try { current = JSON.parse(localStorage.getItem('deltaVetSequenceState') || 'null') } catch {}
  const next = chooseSequence(current, data)
  if (!next) return Number(localStorage.getItem('deltaVetNextPatientNumber') || 1)
  localStorage.setItem('deltaVetSequenceState', JSON.stringify(next))
  localStorage.setItem('deltaVetNextPatientNumber', String(next.value))
  window.dispatchEvent(new CustomEvent('deltaVetSequenceUpdated', { detail: { nextPatientNumber: next.value } }))
  return next.value
}
