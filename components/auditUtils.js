export const AUDIT_LABELS = {
  ENTRADA_CRIADA: 'Entrada cadastrada',
  PACIENTE_EDITADO: 'Cadastro do paciente editado',
  CIRURGIA_CONFIRMADA: 'Cirurgia confirmada',
  ALTA: 'Alta liberada',
  ENTREGUE: 'Entrega confirmada',
  ALTA_CANCELADA: 'Alta cancelada / voltou ao pós-op',
  REINTERNADO_APOS_ENTREGA: 'Paciente reinternado após entrega',
  CLIENTE_CADASTRADO: 'Cliente cadastrado',
  CLIENTE_EDITADO: 'Cliente editado',
  CLIENTE_ARQUIVADO: 'Cliente arquivado',
  CLIENTE_REATIVADO: 'Cliente reativado',
  CLIENTE_EXCLUIDO: 'Cliente excluído',
  REGISTRO_TESTE_EXCLUIDO: 'Registro de teste excluído',
}

export function readAuditLog() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetAuditLog') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function getCurrentActor({
  fallbackName = 'Operação sem login',
  fallbackUsername = 'sem-login',
  fallbackType = 'SISTEMA',
} = {}) {
  try {
    const tablet = JSON.parse(sessionStorage.getItem('deltaVetTabletSession') || 'null')
    if (tablet) {
      return {
        id: tablet.id || null,
        name: tablet.name || tablet.username || 'Usuário',
        username: tablet.username || '',
        type: 'FUNCIONARIO',
      }
    }
  } catch {}

  try {
    const admin = JSON.parse(sessionStorage.getItem('deltaVetAdminSession') || 'null')
    if (admin) {
      return {
        id: null,
        name: admin.username || 'Administrador',
        username: admin.username || 'admin',
        type: 'ADMIN',
      }
    }
  } catch {}

  return {
    id: null,
    name: fallbackName,
    username: fallbackUsername,
    type: fallbackType,
  }
}

export function auditAction({
  action,
  category = 'OPERACIONAL',
  patient = null,
  details = '',
  actor = null,
  at = null,
  metadata = null,
}) {
  const currentActor = actor || getCurrentActor()
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    at: at || new Date().toISOString(),
    action,
    actionLabel: AUDIT_LABELS[action] || action,
    category,
    actorId: currentActor.id || null,
    actorName: currentActor.name || 'Não identificado',
    actorUsername: currentActor.username || '',
    actorType: currentActor.type || 'SISTEMA',
    patientNumber: patient?.number ?? null,
    patientName: patient?.patientName || '',
    tutorName: patient?.tutorName || '',
    details: String(details || '').slice(0, 500),
    metadata: metadata || null,
  }

  const log = readAuditLog()
  log.push(entry)

  // Limite local para evitar crescimento sem fim durante os testes.
  const limited = log.length > 10000 ? log.slice(log.length - 10000) : log
  localStorage.setItem('deltaVetAuditLog', JSON.stringify(limited))

  return entry
}
