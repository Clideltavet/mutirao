export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '')
}

export function formatCpf(value = '') {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`
}

export function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase().slice(0, 120)
}

export function readClients() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetClients') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function saveClients(clients) {
  localStorage.setItem('deltaVetClients', JSON.stringify(clients))
}

export function buildClientsFromPatients() {
  let patients = []
  try {
    patients = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
  } catch {}
  if (!Array.isArray(patients)) patients = []

  const map = new Map()

  patients.forEach((patient) => {
    const name = String(patient.tutorName || '').trim()
    if (!name) return
    const key = name.toLowerCase()

    if (!map.has(key)) {
      map.set(key, {
        id: `legacy-${key}`,
        name,
        phone: patient.phone || '',
        cpf: patient.tutorCpf || '',
        email: patient.tutorEmail || '',
        createdAt: patient.createdAt || new Date().toISOString(),
        updatedAt: null,
      })
    }
  })

  return [...map.values()]
}
