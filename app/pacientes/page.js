'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DischargeModal from '../../components/DischargeModal'

function readPatients() {
  try { return JSON.parse(localStorage.getItem('deltaVetPatients') || '[]') } catch { return [] }
}

function localDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fDate(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}
function fTime(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
}

export default function PacientesPage() {
  const router = useRouter()
  const [patients, setPatients] = useState([])
  const [dayKey, setDayKey] = useState(() => localDateKey())
  const [releasePatient, setReleasePatient] = useState(null)

  function refresh() {
    setPatients(readPatients())
    setDayKey(localDateKey())
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 1000)
    const onStorage = (e) => e.key === 'deltaVetPatients' && refresh()
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const todayPatients = useMemo(
    () => patients.filter((p) => localDateKey(p.createdAt) === dayKey),
    [patients, dayKey]
  )

  const totals = {
    total: todayPatients.length,
    done: todayPatients.filter(p => p.status === 'CONFIRMADO').length,
    pending: todayPatients.filter(p => p.status !== 'CONFIRMADO').length,
    released: todayPatients.filter(p => p.dischargeStatus === 'ALTA' || p.dischargeStatus === 'ENTREGUE').length,
  }

  return (
    <main className="tablet-panel-screen">
      <header className="tablet-panel-header">
        <button className="back-arrow" onClick={() => router.push('/')}>←</button>

        <div>
          <h1>PACIENTES</h1>
          <div className="panel-current-date">{todayLabel()}</div>
          <p>Exibindo somente os pacientes do dia • toque em um animal para abrir</p>
        </div>

        <button className="new-entry-button" onClick={() => router.push('/entrada')}>
          + NOVA ENTRADA
        </button>
      </header>

      <section className="patient-control-kpis">
        <div className="patient-control-date">
          <small>DATA DO CONTROLE</small>
          <strong>{todayLabel()}</strong>
        </div>
        <div><small>PROCEDIMENTOS DO DIA</small><strong>{totals.total}</strong><span>Total programado</span></div>
        <div><small>REALIZADOS</small><strong>{totals.done}</strong><span>Procedimentos confirmados</span></div>
        <div><small>FALTAM</small><strong>{totals.pending}</strong><span>Aguardando procedimento</span></div>
        <div><small>LIBERADOS</small><strong>{totals.released}</strong><span>Alta ou entrega confirmada</span></div>
      </section>

      <section className="tablet-table-wrap">
        <table className="tablet-table">
          <thead>
            <tr>
              <th>HORA</th><th>DATA</th><th>N° FICHA</th><th>PACIENTE</th><th>ESPÉCIE</th><th>SEXO</th>
              <th>PESO</th><th>BOX</th><th>CX</th><th>OBSERVAÇÃO</th><th>TUTOR</th><th>PROCEDIMENTO</th><th>STATUS</th><th>AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {todayPatients.length === 0 ? (
              <tr>
                <td colSpan="14" className="empty-surgery">
                  Nenhum paciente cadastrado hoje.
                </td>
              </tr>
            ) : todayPatients.map((p) => (
              <tr
                key={`${p.number}-${p.createdAt}`}
                className="tablet-patient-row"
                onClick={() => router.push(`/pacientes/${p.number}`)}
              >
                <td>{fTime(p.createdAt)}</td>
                <td>{fDate(p.createdAt)}</td>
                <td className="patient-sheet">{String(p.number).padStart(3,'0')}</td>
                <td className="patient-name-cell">{p.patientName || 'Sem nome'}</td>
                <td>{p.species || '-'}</td>
                <td>{p.sex || '-'}</td>
                <td>{p.weight ? `${p.weight} kg` : '-'}</td>
                <td className="location-number">{p.location === 'BOX' ? (p.locationNumber || '-') : ''}</td>
                <td className="location-number">{p.location === 'Caixa' ? (p.locationNumber || '-') : ''}</td>
                <td className="multiline-cell">
                  <div>{p.notes || '-'}</div>
                  {p.surgeryNotes && <div className="team-note team-note-surgery">Proc.: {p.surgeryNotes}</div>}
                  {p.dischargeNotes && <div className="team-note team-note-discharge">Alta: {p.dischargeNotes}</div>}
                </td>
                <td className="multiline-cell">{p.tutorName || '-'}</td>
                <td className="procedure-cell">
                  {(p.procedures || []).length
                    ? p.procedures.map(x => <div className="procedure-line" key={x}>{x}</div>)
                    : '-'}
                </td>
                <td>
                  {p.dischargeStatus === 'ENTREGUE'
                    ? <span className="delivered-mini-badge">✓ ENTREGUE</span>
                    : p.dischargeStatus === 'ALTA'
                      ? <span className="discharge-ready-badge">✓ ALTA</span>
                      : p.status === 'CONFIRMADO'
                        ? <span className="confirmed-badge">✓ CIRURGIA</span>
                        : <span className="waiting-badge">AGUARDANDO</span>}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {p.dischargeStatus === 'ALTA' ? (
                    <button
                      className="patient-exit-button"
                      onClick={() => router.push('/saida')}
                    >
                      SAÍDA
                    </button>
                  ) : p.dischargeStatus === 'ENTREGUE' ? (
                    <span className="patient-finished-label">FINALIZADO</span>
                  ) : p.status === 'CONFIRMADO' ? (
                    <button
                      className="patient-release-direct-button"
                      onClick={() => setReleasePatient(p)}
                    >
                      LIBERAR
                    </button>
                  ) : (
                    <button
                      className="patient-open-button"
                      onClick={() => router.push(`/pacientes/${p.number}`)}
                    >
                      ABRIR
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>


      {releasePatient && (
        <DischargeModal
          patient={releasePatient}
          onClose={() => setReleasePatient(null)}
          onSaved={(updated) => {
            setPatients(updated)
            setReleasePatient(null)
          }}
        />
      )}

    </main>
  )
}
