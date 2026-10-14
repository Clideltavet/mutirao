export const DEFAULT_ROLES = [
  {
    id: 'recepcao',
    name: 'Recepção',
    description: 'Acesso exclusivo ao painel da recepção.',
    accesses: ['RECEPCAO'],
  },
  {
    id: 'estagiario',
    name: 'Estagiário',
    description: 'Entrada, pacientes e saída no tablet.',
    accesses: ['ENTRADA','PACIENTES','SAIDA'],
  },
  {
    id: 'pos-operatorio',
    name: 'Pós-operatório',
    description: 'Acompanha pacientes e libera alta.',
    accesses: ['PACIENTES'],
  },
  {
    id: 'operacional-completo',
    name: 'Operacional completo',
    description: 'Entrada, pacientes, saída e recepção.',
    accesses: ['ENTRADA','PACIENTES','SAIDA','RECEPCAO'],
  },
]

export const ACCESS_OPTIONS = [
  ['ENTRADA','Entrada'],
  ['PACIENTES','Pacientes'],
  ['SAIDA','Saída'],
  ['RECEPCAO','Recepção'],
  ['CIRURGIA','Cirurgia'],
  ['MASTER','Painel Master'],
  ['RELATORIOS','Relatórios'],
  ['CADASTROS','Cadastros'],
]

export function readRoles() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetRoles') || 'null')
    if (Array.isArray(value) && value.length) return value
  } catch {}
  return DEFAULT_ROLES
}

export function saveRoles(roles) {
  localStorage.setItem('deltaVetRoles', JSON.stringify(roles))
}
