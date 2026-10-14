export async function hashPassword(value) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('')
}
export function getTabletSession() {
  try { return JSON.parse(sessionStorage.getItem('deltaVetTabletSession') || 'null') } catch { return null }
}
export function setTabletSession(v) { sessionStorage.setItem('deltaVetTabletSession', JSON.stringify(v)) }
export function clearTabletSession() { sessionStorage.removeItem('deltaVetTabletSession') }
export function getAdminSession() {
  try { return JSON.parse(sessionStorage.getItem('deltaVetAdminSession') || 'null') } catch { return null }
}
export function setAdminSession(v) { sessionStorage.setItem('deltaVetAdminSession', JSON.stringify(v)) }
export function clearAdminSession() { sessionStorage.removeItem('deltaVetAdminSession') }
