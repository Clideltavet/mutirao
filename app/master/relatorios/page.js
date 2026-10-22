'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PatientRecordModal from '../../../components/PatientRecordModal'
import {
  currencyBRL,
  patientProcedureDetails,
  patientTotalValue,
  readProcedureCatalog,
} from '../../../components/procedureUtils'
import { AUDIT_LABELS, auditAction, readAuditLog } from '../../../components/auditUtils'
import { meApi } from '../../../components/authUtils'
import { patientRecordKey, queueSyncDelete } from '../../../components/syncUtils'

function readPatients() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function dateKey(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function todayKey() {
  return dateKey(new Date())
}

function displayDate(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function statusLabel(patient) {
  if (patient.dischargeStatus === 'ENTREGUE') return 'Entregue'
  if (patient.dischargeStatus === 'ALTA') return 'De alta'
  if (patient.status === 'CONFIRMADO') return 'Pós-operatório'
  return 'Aguardando procedimento'
}

function downloadCsv(rows, filename) {
  const escape = value => `"${String(value ?? '').replaceAll('"','""')}"`
  const csv = rows.map(row => row.map(escape).join(';')).join('\n')
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState([])
  const [from, setFrom] = useState(todayKey())
  const [to, setTo] = useState(todayKey())
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('RESUMO')
  const [selected, setSelected] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [currentAdmin, setCurrentAdmin] = useState(null)

  useEffect(() => {
    const refresh = () => {
      setPatients(readPatients())
      setAuditLog(readAuditLog())
    }
    refresh()
    meApi().then(user => setCurrentAdmin(user)).catch(() => setCurrentAdmin(null))
    const timer = setInterval(refresh, 1500)
    return () => clearInterval(timer)
  }, [])

  const catalog = readProcedureCatalog()

  const periodData = useMemo(() => patients.filter(patient => {
    const date = dateKey(patient.createdAt)
    if (!date) return false
    if (from && date < from) return false
    if (to && date > to) return false
    return true
  }), [patients, from, to])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return periodData

    return periodData.filter(patient =>
      [
        patient.number,
        patient.patientName,
        patient.tutorName,
        patient.phone,
        patient.species,
        patient.veterinarian,
        patient.dischargeVeterinarian,
        patient.tutorCpf,
        patient.tutorEmail,
        ...(patient.procedures || []),
      ].join(' ').toLowerCase().includes(q)
    )
  }, [periodData, query])

  const todayPatients = patients.filter(p => dateKey(p.createdAt) === todayKey())

  const valueToday = todayPatients.reduce((sum,p) => sum + patientTotalValue(p, catalog), 0)
  const valuePeriod = periodData.reduce((sum,p) => sum + patientTotalValue(p, catalog), 0)
  const valueHistory = patients.reduce((sum,p) => sum + patientTotalValue(p, catalog), 0)
  const valueFiltered = filtered.reduce((sum,p) => sum + patientTotalValue(p, catalog), 0)
  const procedureCount = filtered.reduce((sum,p) => sum + (p.procedures || []).length, 0)

  const procedureMap = new Map()
  filtered.forEach(patient => {
    patientProcedureDetails(patient, catalog).forEach(item => {
      const current = procedureMap.get(item.name) || { qty: 0, value: 0 }
      current.qty += 1
      current.value += Number(item.value) || 0
      procedureMap.set(item.name, current)
    })
  })
  const procedureRows = [...procedureMap.entries()]
    .map(([name,data]) => ({ name, ...data }))
    .sort((a,b) => b.value - a.value || b.qty - a.qty)

  const tutorMap = new Map()
  filtered.forEach(patient => {
    const name = patient.tutorName || 'Não informado'
    const current = tutorMap.get(name) || { count: 0, value: 0 }
    current.count += 1
    current.value += patientTotalValue(patient, catalog)
    tutorMap.set(name, current)
  })
  const tutorRows = [...tutorMap.entries()]
    .map(([name,data]) => ({ name, ...data }))
    .sort((a,b) => b.value - a.value || b.count - a.count)

  const dayMap = new Map()
  filtered.forEach(patient => {
    const day = dateKey(patient.createdAt)
    const current = dayMap.get(day) || { count: 0, procedures: 0, value: 0 }
    current.count += 1
    current.procedures += (patient.procedures || []).length
    current.value += patientTotalValue(patient, catalog)
    dayMap.set(day, current)
  })
  const dayRows = [...dayMap.entries()]
    .map(([day,data]) => ({ day, ...data }))
    .sort((a,b) => b.day.localeCompare(a.day))


  const auditPeriod = useMemo(() => {
    return auditLog.filter(entry => {
      const date = dateKey(entry.at)
      if (!date) return false
      if (from && date < from) return false
      if (to && date > to) return false
      return true
    })
  }, [auditLog, from, to])

  const auditFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return auditPeriod

    return auditPeriod.filter(entry =>
      [
        entry.actorName,
        entry.actorUsername,
        entry.actorType,
        entry.actionLabel,
        AUDIT_LABELS[entry.action],
        entry.patientNumber,
        entry.patientName,
        entry.tutorName,
        entry.details,
      ].join(' ').toLowerCase().includes(q)
    )
  }, [auditPeriod, query])

  const auditUserMap = new Map()
  auditFiltered.forEach(entry => {
    const key = `${entry.actorName || 'Não identificado'}|${entry.actorUsername || ''}|${entry.actorType || ''}`
    const current = auditUserMap.get(key) || {
      name: entry.actorName || 'Não identificado',
      username: entry.actorUsername || '',
      type: entry.actorType || '',
      count: 0,
      lastAt: null,
    }
    current.count += 1
    if (!current.lastAt || new Date(entry.at) > new Date(current.lastAt)) current.lastAt = entry.at
    auditUserMap.set(key, current)
  })
  const auditUserRows = [...auditUserMap.values()].sort((a,b) => b.count - a.count)

  function auditDateTime(value) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR')
  }

  function deleteTestPatient(patient) {
    if (currentAdmin?.roleId !== 'admin') {
      window.alert('Somente o Administrador pode excluir um registro de teste.')
      return
    }

    const first = window.confirm(
      `EXCLUIR REGISTRO DE TESTE?\n\nFicha: ${String(patient.number || '').padStart(3,'0')}\nPaciente: ${patient.patientName || 'Sem nome'}\nTutor: ${patient.tutorName || '-'}\n\nEsta ação remove o registro dos aparelhos e do Neon.`
    )
    if (!first) return

    const confirmation = window.prompt(
      'Confirmação final: digite EXCLUIR para remover definitivamente este registro de teste.'
    )

    if (String(confirmation || '').trim().toUpperCase() !== 'EXCLUIR') {
      window.alert('Exclusão cancelada.')
      return
    }

    auditAction({
      action: 'REGISTRO_TESTE_EXCLUIDO',
      category: 'ADMIN',
      patient,
      details: `Registro de teste excluído pelo Administrador • Ficha ${String(patient.number || '').padStart(3,'0')}`,
    })

    queueSyncDelete('patients', patientRecordKey(patient))

    const current = readPatients()
    const targetKey = patientRecordKey(patient)
    const next = current.filter(item => patientRecordKey(item) !== targetKey)

    localStorage.setItem('deltaVetPatients', JSON.stringify(next))
    setPatients(next)
    setAuditLog(readAuditLog())
    setSelected(null)

    window.alert('Registro de teste removido. A exclusão será sincronizada com o Neon.')
  }

  function exportCurrent() {
    const rows = [
      ['Ficha','Paciente','Data','Tutor','Espécie','Sexo','Procedimentos','Valor','Veterinário','Status'],
      ...filtered.map(p => [
        String(p.number || '').padStart(3,'0'),
        p.patientName || '',
        displayDate(p.createdAt),
        p.tutorName || '',
        p.species || '',
        p.sex || '',
        (p.procedures || []).join(' | '),
        patientTotalValue(p, catalog).toFixed(2).replace('.',','),
        p.veterinarian || '',
        statusLabel(p),
      ])
    ]
    downloadCsv(rows, `delta-vet-relatorio-${from || 'inicio'}-${to || 'hoje'}.csv`)
  }

  return (
    <main className="cms-screen reports-pro-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">PAINEL CMS</span>
          <h1>RELATÓRIOS E FINANCEIRO</h1>
          <p>Pesquise por tutor, paciente ou número da ficha e consulte todo o histórico do atendimento.</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master')}>← VOLTAR</button>
      </header>

      <section className="report-search-panel">
        <div className="report-search-input">
          <span>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar nome do tutor, paciente, ficha, telefone ou procedimento..."
          />
        </div>

        <label>
          <span>De</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>

        <label>
          <span>Até</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>

        <button onClick={() => { setFrom(todayKey()); setTo(todayKey()) }}>HOJE</button>
        <button onClick={() => { setFrom(''); setTo('') }}>TODO HISTÓRICO</button>
        <button className="report-export" onClick={exportCurrent}>EXPORTAR CSV</button>
      </section>

      <section className="finance-kpi-grid">
        <div>
          <small>VALOR HOJE</small>
          <strong>{currencyBRL(valueToday)}</strong>
          <span>{todayPatients.length} pacientes</span>
        </div>
        <div>
          <small>VALOR NO PERÍODO</small>
          <strong>{currencyBRL(valuePeriod)}</strong>
          <span>{periodData.length} pacientes</span>
        </div>
        <div>
          <small>VALOR TOTAL HISTÓRICO</small>
          <strong>{currencyBRL(valueHistory)}</strong>
          <span>Todos os registros</span>
        </div>
        <div className={query ? 'finance-kpi-highlight' : ''}>
          <small>VALOR DA PESQUISA</small>
          <strong>{currencyBRL(valueFiltered)}</strong>
          <span>{filtered.length} resultados</span>
        </div>
        <div>
          <small>PROCEDIMENTOS FILTRADOS</small>
          <strong>{procedureCount}</strong>
          <span>Quantidade realizada</span>
        </div>
      </section>

      <nav className="report-tabs reports-pro-tabs">
        {['RESUMO','PACIENTES','TUTORES','PROCEDIMENTOS','FINANCEIRO','AUDITORIA'].map(item => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>

      {tab === 'RESUMO' && (
        <section className="reports-summary-grid">
          <div className="report-table-card">
            <h2>Valor por procedimento</h2>
            <table className="cms-table">
              <thead><tr><th>Procedimento</th><th>Qtd.</th><th>Valor</th></tr></thead>
              <tbody>
                {procedureRows.length ? procedureRows.map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.qty}</td>
                    <td><strong>{currencyBRL(row.value)}</strong></td>
                  </tr>
                )) : <tr><td colSpan="3">Sem dados.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="report-table-card">
            <h2>Valores por tutor</h2>
            <table className="cms-table">
              <thead><tr><th>Tutor</th><th>Animais</th><th>Valor</th></tr></thead>
              <tbody>
                {tutorRows.slice(0,20).length ? tutorRows.slice(0,20).map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.count}</td>
                    <td><strong>{currencyBRL(row.value)}</strong></td>
                  </tr>
                )) : <tr><td colSpan="3">Sem dados.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'PACIENTES' && (
        <section className="report-table-card">
          <div className="report-table-title-row">
            <div>
              <h2>Histórico de pacientes</h2>
              <p>Clique em VER FICHA para abrir o prontuário/anamnese do atendimento.</p>
            </div>
            <strong>{filtered.length} registros</strong>
          </div>

          <div className="reports-table-scroll">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Ficha</th>
                  <th>Paciente</th>
                  <th>Data</th>
                  <th>Tutor</th>
                  <th>Procedimentos</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map(patient => (
                  <tr key={`${patient.number}-${patient.createdAt}`}>
                    <td><strong>{String(patient.number || '').padStart(3,'0')}</strong></td>
                    <td>{patient.patientName || 'Sem nome'}</td>
                    <td>{displayDate(patient.createdAt)}</td>
                    <td>{patient.tutorName || '-'}</td>
                    <td>{(patient.procedures || []).join(', ') || '-'}</td>
                    <td><strong>{currencyBRL(patientTotalValue(patient, catalog))}</strong></td>
                    <td>{statusLabel(patient)}</td>
                    <td>
                      <button className="record-open-button" onClick={() => setSelected(patient)}>
                        VER FICHA
                      </button>
                    </td>
                  </tr>
                )) : <tr><td colSpan="8">Nenhum registro encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'TUTORES' && (
        <section className="report-table-card">
          <h2>Totais por tutor</h2>
          <table className="cms-table">
            <thead><tr><th>Tutor</th><th>Animais</th><th>Valor total</th></tr></thead>
            <tbody>
              {tutorRows.length ? tutorRows.map(row => (
                <tr key={row.name}><td>{row.name}</td><td>{row.count}</td><td><strong>{currencyBRL(row.value)}</strong></td></tr>
              )) : <tr><td colSpan="3">Sem dados.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'PROCEDIMENTOS' && (
        <section className="report-table-card">
          <h2>Produção por procedimento</h2>
          <table className="cms-table">
            <thead><tr><th>Procedimento</th><th>Quantidade</th><th>Valor total</th><th>Valor médio</th></tr></thead>
            <tbody>
              {procedureRows.length ? procedureRows.map(row => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.qty}</td>
                  <td><strong>{currencyBRL(row.value)}</strong></td>
                  <td>{currencyBRL(row.qty ? row.value / row.qty : 0)}</td>
                </tr>
              )) : <tr><td colSpan="4">Sem dados.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'FINANCEIRO' && (
        <section className="report-table-card">
          <h2>Fechamento por dia</h2>
          <table className="cms-table">
            <thead><tr><th>Data</th><th>Pacientes</th><th>Procedimentos</th><th>Valor</th></tr></thead>
            <tbody>
              {dayRows.length ? dayRows.map(row => (
                <tr key={row.day}>
                  <td>{row.day.split('-').reverse().join('/')}</td>
                  <td>{row.count}</td>
                  <td>{row.procedures}</td>
                  <td><strong>{currencyBRL(row.value)}</strong></td>
                </tr>
              )) : <tr><td colSpan="4">Sem dados.</td></tr>}
            </tbody>
          </table>
        </section>
      )}


      {tab === 'AUDITORIA' && (
        <section className="audit-report-layout">
          <div className="audit-summary-grid">
            <div className="audit-summary-card">
              <small>AÇÕES NO PERÍODO</small>
              <strong>{auditFiltered.length}</strong>
              <span>Registros encontrados com os filtros atuais.</span>
            </div>

            <div className="audit-summary-card">
              <small>USUÁRIOS ATIVOS</small>
              <strong>{auditUserRows.length}</strong>
              <span>Usuários/origens que realizaram ações.</span>
            </div>

            <div className="audit-summary-card">
              <small>AÇÕES HOJE</small>
              <strong>{auditLog.filter(entry => dateKey(entry.at) === todayKey()).length}</strong>
              <span>Movimentações registradas hoje.</span>
            </div>
          </div>

          <div className="reports-summary-grid audit-top-grid">
            <section className="report-table-card">
              <h2>Ações por usuário</h2>
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Origem</th>
                    <th>Ações</th>
                    <th>Última ação</th>
                  </tr>
                </thead>
                <tbody>
                  {auditUserRows.length ? auditUserRows.map(user => (
                    <tr key={`${user.name}-${user.username}-${user.type}`}>
                      <td>
                        <strong>{user.name}</strong>
                        <div className="audit-username">{user.username ? `@${user.username}` : '-'}</div>
                      </td>
                      <td>{user.type || '-'}</td>
                      <td><strong>{user.count}</strong></td>
                      <td>{auditDateTime(user.lastAt)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4">Nenhuma ação registrada no período.</td></tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="report-table-card">
              <h2>O que está sendo controlado</h2>
              <div className="audit-action-catalog">
                <span>Entrada cadastrada</span>
                <span>Edição do paciente</span>
                <span>Cirurgia confirmada</span>
                <span>Alta liberada</span>
                <span>Entrega confirmada</span>
                <span>Retorno ao pós-operatório</span>
                <span>Reinternação</span>
                <span>Cadastro/edição de cliente</span>
              </div>
              <p className="audit-help">
                A TV da cirurgia continua sem login. Quando uma ação for feita diretamente nela,
                o relatório identifica a origem como <strong>TV Sala de Cirurgia</strong>.
              </p>
            </section>
          </div>

          <section className="report-table-card">
            <div className="report-table-title-row">
              <div>
                <h2>Histórico detalhado de ações</h2>
                <p>Use a pesquisa acima para procurar um usuário, paciente, tutor, ficha ou ação.</p>
              </div>
              <strong>{auditFiltered.length} ações</strong>
            </div>

            <div className="reports-table-scroll">
              <table className="cms-table audit-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Usuário</th>
                    <th>Origem</th>
                    <th>Ação</th>
                    <th>Ficha</th>
                    <th>Paciente</th>
                    <th>Tutor</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditFiltered.length ? auditFiltered
                    .slice()
                    .sort((a,b) => new Date(b.at) - new Date(a.at))
                    .map(entry => (
                      <tr key={entry.id}>
                        <td>{auditDateTime(entry.at)}</td>
                        <td>
                          <strong>{entry.actorName || 'Não identificado'}</strong>
                          <div className="audit-username">
                            {entry.actorUsername ? `@${entry.actorUsername}` : '-'}
                          </div>
                        </td>
                        <td>
                          <span className={`audit-origin audit-origin-${String(entry.actorType || 'sistema').toLowerCase()}`}>
                            {entry.actorType || 'SISTEMA'}
                          </span>
                        </td>
                        <td><strong>{entry.actionLabel || AUDIT_LABELS[entry.action] || entry.action}</strong></td>
                        <td>{entry.patientNumber != null ? String(entry.patientNumber).padStart(3,'0') : '-'}</td>
                        <td>{entry.patientName || '-'}</td>
                        <td>{entry.tutorName || '-'}</td>
                        <td>{entry.details || '-'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="8">Nenhuma ação registrada com os filtros atuais.</td></tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {selected && (
        <PatientRecordModal
          patient={selected}
          showValues
          allowDelete={currentAdmin?.roleId === 'admin'}
          onDelete={deleteTestPatient}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}
