'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DischargeModal from '../../../components/DischargeModal'
import SurgeryConfirmModal from '../../../components/SurgeryConfirmModal'

function readPatients() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function formatTime(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function PatientOperationalPage() {
  const params = useParams()
  const router = useRouter()
  const number = Number(params.id)
  const [patients, setPatients] = useState([])
  const [showSurgery, setShowSurgery] = useState(false)
  const [showDischarge, setShowDischarge] = useState(false)

  function refresh(updated) {
    setPatients(updated || readPatients())
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(() => refresh(), 1000)
    const onStorage = event => event.key === 'deltaVetPatients' && refresh()
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const patient = patients.find(item => Number(item.number) === number)

  if (!patient) {
    return (
      <main className="patient-op-screen">
        <section className="patient-op-card">
          <h1>Paciente não encontrado</h1>
          <button className="edit-secondary-button" onClick={() => router.push('/pacientes')}>← VOLTAR</button>
        </section>
      </main>
    )
  }

  const delivered = patient.dischargeStatus === 'ENTREGUE'
  const discharged = patient.dischargeStatus === 'ALTA'
  const surgeryDone = patient.status === 'CONFIRMADO'

  return (
    <main className="patient-op-screen">
      <section className="patient-op-card">
        <header className="patient-op-header">
          <button className="back-arrow" onClick={() => router.push('/pacientes')}>←</button>
          <div className="patient-op-header-copy">
            <span className="patient-op-kicker">PACIENTE</span>
            <h1>{patient.patientName || 'Paciente sem nome'} • FICHA Nº {String(patient.number).padStart(3, '0')}</h1>
          </div>
          <button
            className="edit-secondary-button"
            onClick={() => router.push(`/pacientes/${patient.number}/editar`)}
          >
            EDITAR CADASTRO
          </button>
        </header>

        <section className="patient-op-summary">
          <div className="patient-op-animal">
            <span className="patient-op-icon">{patient.species === 'FELINO' ? '🐱' : '🐶'}</span>
            <div>
              <strong>{patient.species || '-'} • {patient.sex || '-'}</strong>
              <span>{patient.weight ? `${patient.weight} kg` : 'Peso não informado'}</span>
            </div>
          </div>

          <div><small>TUTOR</small><strong>{patient.tutorName || '-'}</strong></div>
          <div><small>LOCAL</small><strong>{patient.location || '-'} {patient.locationNumber || ''}</strong></div>
          <div><small>PROCEDIMENTOS</small><strong>{(patient.procedures || []).join(' • ') || '-'}</strong></div>
        </section>

        <section className="patient-op-status">
          <h2>SITUAÇÃO DO PACIENTE</h2>

          {!surgeryDone && (
            <div className="op-state waiting-op">
              <div>
                <span>AGUARDANDO PROCEDIMENTO</span>
                <small>O procedimento ainda não foi confirmado.</small>
              </div>
              <button onClick={() => setShowSurgery(true)}>CONFIRMAR CIRURGIA</button>
            </div>
          )}

          {surgeryDone && !discharged && !delivered && (
            <div className="op-state postop-op">
              <div>
                <span>✓ CIRURGIA CONFIRMADA</span>
                <small>Cirurgia confirmada • paciente aguardando a etapa LIBERAR.</small>
              </div>
              <button onClick={() => setShowDischarge(true)}>LIBERAR ALTA</button>
            </div>
          )}

          {discharged && (
            <div className="op-state discharge-op">
              <div>
                <span>✓ DE ALTA</span>
                <small>Alta às {formatTime(patient.dischargedAt)} • a próxima etapa é a tela SAÍDA.</small>
              </div>
              <button className="go-exit-button" onClick={() => router.push('/saida')}>IR PARA SAÍDA</button>
            </div>
          )}

          {delivered && (
            <div className="op-state delivered-op">
              <div>
                <span>✓ ENTREGUE</span>
                <small>Paciente entregue às {formatTime(patient.deliveredAt)}.</small>
              </div>
            </div>
          )}
        </section>

        <section className="patient-op-info">
          <div><small>VETERINÁRIO DO PROCEDIMENTO</small><strong>{patient.veterinarian || 'Não informado'}</strong></div>
          <div><small>VETERINÁRIO DA ALTA</small><strong>{patient.dischargeVeterinarian || '-'}</strong></div>
          <div><small>OBSERVAÇÕES DA ENTRADA</small><strong>{patient.notes || '-'}</strong></div>
          <div><small>OBSERVAÇÕES DO PROCEDIMENTO</small><strong>{patient.surgeryNotes || '-'}</strong></div>
          <div className="patient-op-important-note"><small>OBSERVAÇÕES DA ALTA</small><strong>{patient.dischargeNotes || '-'}</strong></div>
          <div><small>ADICIONAIS CIRÚRGICOS</small><strong>{(patient.surgeryExtras || []).join(' • ') || '-'}</strong></div>
        </section>
      </section>

      {showSurgery && (
        <SurgeryConfirmModal
          patient={patient}
          onClose={() => setShowSurgery(false)}
          onSaved={refresh}
        />
      )}

      {showDischarge && (
        <DischargeModal
          patient={patient}
          onClose={() => setShowDischarge(false)}
          onSaved={refresh}
        />
      )}
    </main>
  )
}
