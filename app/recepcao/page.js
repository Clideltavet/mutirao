'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PatientRecordModal from '../../components/PatientRecordModal'
import { clearTabletSession, getTabletSession, logoutApi } from '../../components/authUtils'

function readPatients() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function dayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function time(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function ReceptionPage() {
  const router = useRouter()
  const [patients, setPatients] = useState([])
  const [selected, setSelected] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    setSession(getTabletSession())
    const refresh = () => setPatients(readPatients())
    refresh()
    const timer = setInterval(refresh, 1000)
    const onStorage = e => e.key === 'deltaVetPatients' && refresh()
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const today = dayKey()
  const data = useMemo(
    () => patients
      .filter(p => dayKey(p.createdAt) === today)
      .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [patients, today]
  )

  const released = data.filter(p => p.dischargeStatus === 'ALTA' || p.dischargeStatus === 'ENTREGUE').length
  const inProcedure = data.length - released
  const done = data.filter(p => p.status === 'CONFIRMADO').length

  return (
    <main className="reception-screen">
      <header className="reception-header">
        <div>
          <span>CONTROLE DELTA VET</span>
          <h1>PAINEL DA RECEPÇÃO</h1>
          <p>{todayLabel()}</p>
        </div>
        <div className="reception-user-actions">
          <div>
            <small>USUÁRIO</small>
            <strong>{session?.name || 'Recepção'}</strong>
          </div>
          <button
            onClick={async () => {
              await logoutApi()
              clearTabletSession()
              router.replace('/')
            }}
          >
            SAIR
          </button>
        </div>
      </header>

      <section className="reception-kpis">
        <div><small>PACIENTES DO DIA</small><strong>{data.length}</strong></div>
        <div><small>EM PROCEDIMENTO</small><strong>{inProcedure}</strong></div>
        <div><small>PROCEDIMENTOS FEITOS</small><strong>{done}</strong></div>
        <div><small>LIBERADOS</small><strong>{released}</strong></div>
      </section>

      <div className="reception-legend">
        <span className="legend-yellow">● Em procedimento / aguardando</span>
        <span className="legend-green">● Liberado para saída</span>
      </div>

      <section className="reception-table-wrap">
        <table className="reception-table">
          <thead>
            <tr>
              <th>HORA</th>
              <th>FICHA</th>
              <th>PACIENTE</th>
              <th>ESPÉCIE</th>
              <th>SEXO</th>
              <th>LOCAL</th>
              <th>TUTOR</th>
              <th>PROCEDIMENTO</th>
              <th>SITUAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map(patient => {
              const isReleased = patient.dischargeStatus === 'ALTA' || patient.dischargeStatus === 'ENTREGUE'
              return (
                <tr
                  key={`${patient.number}-${patient.createdAt}`}
                  className={isReleased ? 'reception-row-released' : 'reception-row-procedure'}
                  onClick={() => setSelected(patient)}
                >
                  <td>{time(patient.createdAt)}</td>
                  <td className="patient-sheet">{String(patient.number).padStart(3,'0')}</td>
                  <td><strong>{patient.patientName || 'Sem nome'}</strong></td>
                  <td>{patient.species || '-'}</td>
                  <td>{patient.sex || '-'}</td>
                  <td>{patient.location || '-'} {patient.locationNumber || ''}</td>
                  <td>{patient.tutorName || '-'}</td>
                  <td>{(patient.procedures || []).join(' • ') || '-'}</td>
                  <td>
                    <span className={isReleased ? 'reception-status-green' : 'reception-status-yellow'}>
                      {patient.dischargeStatus === 'ENTREGUE'
                        ? 'ENTREGUE'
                        : patient.dischargeStatus === 'ALTA'
                          ? 'LIBERADO'
                          : patient.status === 'CONFIRMADO'
                            ? 'PÓS-OP'
                            : 'EM PROCEDIMENTO'}
                    </span>
                  </td>
                </tr>
              )
            }) : (
              <tr><td colSpan="9" className="cms-empty">Nenhum paciente cadastrado hoje.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <PatientRecordModal
          patient={selected}
          showValues={false}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}
