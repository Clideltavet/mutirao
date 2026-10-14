export function getTabletSession() {
  try {
    return JSON.parse(sessionStorage.getItem('deltaVetTabletSession') || 'null')
  } catch {
    return null
  }
}

export function setTabletSession(session) {
  sessionStorage.setItem('deltaVetTabletSession', JSON.stringify(session))
}

export function clearTabletSession() {
  sessionStorage.removeItem('deltaVetTabletSession')
}

export function getAdminSession() {
  try {
    return JSON.parse(sessionStorage.getItem('deltaVetAdminSession') || 'null')
  } catch {
    return null
  }
}

export function setAdminSession(session) {
  sessionStorage.setItem('deltaVetAdminSession', JSON.stringify(session))
}

export function clearAdminSession() {
  sessionStorage.removeItem('deltaVetAdminSession')
}

export async function loginApi(username, password, requiredAccess = null) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, requiredAccess }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.')
  return data.user
}

export async function meApi() {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return null
  const data = await response.json()
  return data.user || null
}

export async function logoutApi() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  clearTabletSession()
  clearAdminSession()
}
