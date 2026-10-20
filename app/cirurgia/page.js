'use client'

import { useEffect, useMemo, useState } from 'react'
import DischargeModal from '../../components/DischargeModal'
import { auditAction } from '../../components/auditUtils'
import SyncStatus from '../../components/SyncStatus'

const DEFAULT_EXTRAS = ['Já castrada', 'Cio', 'Piometra', 'Prenhez']

function readJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function readPatients() {
  const value = readJSON('deltaVetPatients', [])
  return Array.isArray(value) ? value : []
}

function readExtras() {
  const value = readJSON('deltaVetSurgeryExtras', DEFAULT_EXTRAS)
  return Array.isArray(value) && value.length ? value : DEFAULT_EXTRAS
}

function readVets() {
  const value = readJSON('deltaVetVeterinarians', [])
  return Array.isArray(value) ? value : []
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

function formatDate(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function formatTime(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function CirurgiaPage() {
  const [patients, setPatients] = useState([])
  const [extrasOptions, setExtrasOptions] = useState(DEFAULT_EXTRAS)
  const [veterinarians, setVeterinarians] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedExtras, setSelectedExtras] = useState([])
  const [selectedVet, setSelectedVet] = useState('')
  const [step, setStep] = useState(0)
  const [dayKey, setDayKey] = useState(() => localDateKey())
  const [modalError, setModalError] = useState('')
  const [panelTab, setPanelTab] = useState('CIRURGIAS')
  const [surgeryNotes, setSurgeryNotes] = useState('')
  const [dischargePatient, setDischargePatient] = useState(null)

  function refresh() {
    setPatients(readPatients())
    setExtrasOptions(readExtras())
    setVeterinarians(readVets())
    setDayKey(localDateKey())
  }

  useEffect(() => {
    refresh()
    const onStorage = (event) => {
      if (
        event.key === 'deltaVetPatients' ||
        event.key === 'deltaVetSurgeryExtras' ||
        event.key === 'deltaVetVeterinarians'
      ) refresh()
    }
    window.addEventListener('storage', onStorage)
    const timer = setInterval(refresh, 1200)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(timer)
    }
  }, [])

  const todayPatients = useMemo(() => {
    return patients
      .filter((patient) => localDateKey(patient.createdAt) === dayKey)
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  }, [patients, dayKey])

  const surgeryPatients = useMemo(
    () => todayPatients.filter((patient) => patient.status !== 'CONFIRMADO'),
    [todayPatients]
  )

  const releasePatients = useMemo(
    () => todayPatients.filter(
      (patient) => patient.status === 'CONFIRMADO' && !patient.dischargeStatus
    ),
    [todayPatients]
  )

  const visiblePatients = panelTab === 'CIRURGIAS' ? surgeryPatients : releasePatients

  function openConfirm(patient) {
    if (patient.status === 'CONFIRMADO') return
    setSelectedPatient(patient)
    setSelectedExtras(Array.isArray(patient.surgeryExtras) ? patient.surgeryExtras : [])
    setSelectedVet(patient.veterinarian || '')
    setSurgeryNotes(patient.surgeryNotes || '')
    setModalError('')
    setStep(1)
  }

  function toggleExtra(extra) {
    setSelectedExtras((current) =>
      current.includes(extra)
        ? current.filter((item) => item !== extra)
        : [...current, extra]
    )
  }

  function goReview() {
    setModalError('')
    setStep(2)
  }

  function saveFinal() {
    if (!selectedPatient) return
    const at = new Date().toISOString()
    const actor = {
      id: null,
      name: 'TV Sala de Cirurgia',
      username: 'tv-cirurgia',
      type: 'TV',
    }
    const updated = readPatients().map((patient) =>
      Number(patient.number) === Number(selectedPatient.number)
        ? {
            ...patient,
            surgeryExtras: selectedExtras,
            veterinarian: selectedVet || '',
            surgeryNotes: surgeryNotes.trim(),
            status: 'CONFIRMADO',
            confirmedAt: at,
            _syncUpdatedAt: at,
            timeline: [
              ...(Array.isArray(patient.timeline) ? patient.timeline : []),
              {
                type: 'CIRURGIA_CONFIRMADA',
                at,
                veterinarian: selectedVet || '',
                notes: surgeryNotes.trim(),
                actor,
              },
            ],
          }
        : patient
    )
    localStorage.setItem('deltaVetPatients', JSON.stringify(updated))

    const savedPatient = updated.find(patient => Number(patient.number) === Number(selectedPatient.number))
    auditAction({
      action: 'CIRURGIA_CONFIRMADA',
      category: 'CIRURGIA',
      patient: savedPatient,
      actor,
      at,
      details: `Confirmação feita na TV da sala cirúrgica${selectedVet ? ` • Veterinário: ${selectedVet}` : ''}`,
    })

    setPatients(updated)
    setSelectedPatient(null)
    setSelectedExtras([])
    setSelectedVet('')
    setSurgeryNotes('')
    setPanelTab('LIBERAR')
    setStep(0)
  }

  return (
    <main className="surgery-screen">
      <header className="surgery-header">
        <div>
          <h1>PAINEL CIRÚRGICO DELTA VET</h1>
          <div className="panel-current-date">{todayLabel()}</div>
          <p>Pacientes recebidos do tablet • exibindo somente o dia atual</p>
        </div>
        <div className="surgery-live"><span className="live-dot" />AO VIVO</div>
      </header>

      <section className="surgery-tabs">
        <button
          type="button"
          className={panelTab === 'CIRURGIAS' ? 'active' : ''}
          onClick={() => setPanelTab('CIRURGIAS')}
        >
          CIRURGIAS <b>{surgeryPatients.length}</b>
        </button>
        <button
          type="button"
          className={panelTab === 'LIBERAR' ? 'active' : ''}
          onClick={() => setPanelTab('LIBERAR')}
        >
          LIBERAR <b>{releasePatients.length}</b>
        </button>
      </section>

      <section className="surgery-table-wrap">
        <table className="surgery-table">
          <thead>
            <tr>
              <th>HORA</th><th>DATA</th><th>N° FICHA</th><th>PACIENTE</th><th>ESPÉCIE</th><th>SEXO</th>
              <th>PESO</th><th>BOX</th><th>CX</th><th>OBSERVAÇÃO</th><th>TUTOR</th>
              <th>PROCEDIMENTO</th><th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {visiblePatients.length === 0 ? (
              <tr><td colSpan="13" className="empty-surgery">{panelTab === 'CIRURGIAS' ? 'Nenhuma cirurgia aguardando confirmação.' : 'Nenhum paciente aguardando liberação.'}</td></tr>
            ) : visiblePatients.map((patient) => (
              <tr key={`${patient.number}-${patient.createdAt}`} className={patient.status === 'CONFIRMADO' ? 'row-confirmed' : ''}>
                <td>{formatTime(patient.createdAt)}</td>
                <td>{formatDate(patient.createdAt)}</td>
                <td className="patient-sheet">{String(patient.number || '').padStart(3, '0')}</td>
                <td className="patient-name-cell">{patient.patientName || 'Sem nome'}</td>
                <td>{patient.species || '-'}</td>
                <td>{patient.sex || '-'}</td>
                <td>{patient.weight ? `${patient.weight} kg` : '-'}</td>
                <td className="location-number">{patient.location === 'BOX' ? (patient.locationNumber || '-') : ''}</td>
                <td className="location-number">{patient.location === 'Caixa' ? (patient.locationNumber || '-') : ''}</td>
                <td className="multiline-cell">
                  <div>{patient.notes || '-'}</div>
                  {patient.surgeryNotes && (
                    <div className="team-note team-note-surgery">
                      Procedimento: {patient.surgeryNotes}
                    </div>
                  )}
                  {patient.dischargeNotes && (
                    <div className="team-note team-note-discharge">
                      Alta: {patient.dischargeNotes}
                    </div>
                  )}
                  {patient.status === 'CONFIRMADO' && patient.surgeryExtras?.length > 0 && (
                    <div className="extras-inline">
                      {patient.surgeryExtras.map((item) => <span key={item}>{item}</span>)}
                    </div>
                  )}
                  {patient.veterinarian && (
                    <div className="vet-inline">Vet.: {patient.veterinarian}</div>
                  )}
                </td>
                <td className="multiline-cell">{patient.tutorName || '-'}</td>
                <td className="procedure-cell">
                  {patient.procedures?.length
                    ? patient.procedures.map((procedure) => <div key={procedure} className="procedure-line">{procedure}</div>)
                    : '-'}
                </td>
                <td className="status-cell">
                  {panelTab === 'CIRURGIAS' ? (
                    <button type="button" className="confirm-row-button" onClick={() => openConfirm(patient)}>
                      CONFIRMAR
                    </button>
                  ) : (
                    <div className="surgery-status-stack">
                      <div className="confirmed-badge">✓ CIRURGIA</div>
                      <button type="button" className="release-row-button" onClick={() => setDischargePatient(patient)}>
                        LIBERAR ALTA
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {step === 1 && selectedPatient && (
        <div className="modal-backdrop">
          <section className="surgery-modal">
            <h2>INFORMAÇÕES DO ANIMAL</h2>

            <div className="animal-summary">
              <strong>{selectedPatient.patientName || 'Paciente sem nome'} • nº {String(selectedPatient.number).padStart(3, '0')}</strong>
              <span>{selectedPatient.species} • {selectedPatient.sex}{selectedPatient.weight ? ` • ${selectedPatient.weight} kg` : ''}</span>
              <span>Tutor: {selectedPatient.tutorName || '-'}</span>
              <span>Procedimento: {(selectedPatient.procedures || []).join(' / ') || '-'}</span>
            </div>

            <label className="modal-field">
              <span>Veterinário responsável <small>(opcional)</small></span>
              <select value={selectedVet} onChange={(e) => setSelectedVet(e.target.value)}>
                <option value="">Selecione...</option>
                {veterinarians.map((vet) => <option value={vet} key={vet}>{vet}</option>)}
              </select>
              {veterinarians.length === 0 && (
                <small>Nenhum veterinário cadastrado. Cadastre no Painel Mestre → Configurações.</small>
              )}
            </label>

            <label className="modal-field">
              <span>Observações sobre o procedimento</span>
              <textarea
                value={surgeryNotes}
                onChange={(e) => setSurgeryNotes(e.target.value)}
                placeholder="Registre alguma informação importante do procedimento..."
              />
            </label>

            <div className="modal-section-title">Adicionais / informações cirúrgicas</div>
            <div className="extras-grid">
              {extrasOptions.map((extra) => (
                <label className="modal-check" key={extra}>
                  <input type="checkbox" checked={selectedExtras.includes(extra)} onChange={() => toggleExtra(extra)} />
                  <span>{extra}</span>
                </label>
              ))}
            </div>

            {modalError && <div className="modal-error">{modalError}</div>}

            <div className="modal-actions">
              <button type="button" className="modal-secondary" onClick={() => { setStep(0); setSelectedPatient(null); }}>
                CANCELAR
              </button>
              <button type="button" className="modal-primary" onClick={goReview}>CONFIRMAR</button>
            </div>
          </section>
        </div>
      )}

      {step === 2 && selectedPatient && (
        <div className="modal-backdrop">
          <section className="surgery-modal final-modal">
            <h2>CONFIRMAR ALTERAÇÕES</h2>
            <div className="final-patient">
              Paciente nº {String(selectedPatient.number).padStart(3, '0')} — {selectedPatient.species} / {selectedPatient.sex}
            </div>

            <div className="final-box">
              <div className="review-row"><strong>Veterinário:</strong><span>{selectedVet || 'Não informado'}</span></div>
              <div className="review-row"><strong>Observação:</strong><span>{surgeryNotes.trim() || 'Nenhuma'}</span></div>
              <div className="modal-section-title review-title">Informações marcadas</div>
              {selectedExtras.length > 0 ? (
                <div className="final-extra-list">
                  {selectedExtras.map((extra) => <div key={extra}>✓ {extra}</div>)}
                </div>
              ) : <div className="no-extra">Nenhum adicional marcado.</div>}
            </div>

            <p className="final-question">Confirma definitivamente estas informações?</p>
            <div className="modal-actions">
              <button type="button" className="modal-secondary" onClick={() => setStep(1)}>VOLTAR</button>
              <button type="button" className="modal-primary final-confirm" onClick={saveFinal}>
                CONFIRMAR DEFINITIVO
              </button>
            </div>
          </section>
        </div>
      )}

      {dischargePatient && (
        <DischargeModal
          patient={dischargePatient}
          onClose={() => setDischargePatient(null)}
          onSaved={(updated) => setPatients(updated)}
        />
      )}

    </main>
  )
}
