'use client'

import { useEffect, useState } from 'react'
import { auditAction, getCurrentActor } from './auditUtils'

function readVets() {
  try {
    const v = JSON.parse(localStorage.getItem('deltaVetVeterinarians') || '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

export default function DischargeModal({ patient, onClose, onSaved }) {
  const [vets, setVets] = useState([])
  const [vet, setVet] = useState(patient?.dischargeVeterinarian || patient?.veterinarian || '')
  const [notes, setNotes] = useState(patient?.dischargeNotes || '')
  const [error, setError] = useState('')

  useEffect(() => setVets(readVets()), [])

  if (!patient) return null

  function save() {
    if (!vet) {
      setError('Selecione o veterinário que autorizou a alta.')
      return
    }
    let all = []
    try { all = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]') } catch {}
    if (!Array.isArray(all)) all = []

    const at = new Date().toISOString()
    const actor = getCurrentActor({
      fallbackName: 'TV Sala de Cirurgia',
      fallbackUsername: 'tv-cirurgia',
      fallbackType: 'TV',
    })
    const updated = all.map(p => Number(p.number) === Number(patient.number) ? {
      ...p,
      dischargeStatus: 'ALTA',
      dischargedAt: at,
            _syncUpdatedAt: at,
      dischargeVeterinarian: vet,
      dischargeNotes: notes.trim(),
      timeline: [
        ...(Array.isArray(p.timeline) ? p.timeline : []),
        { type: 'ALTA', at, veterinarian: vet, notes: notes.trim(), actor }
      ]
    } : p)

    localStorage.setItem('deltaVetPatients', JSON.stringify(updated))

    const savedPatient = updated.find(p => Number(p.number) === Number(patient.number))
    auditAction({
      action: 'ALTA',
      category: 'ALTA',
      patient: savedPatient,
      actor,
      at,
      details: `Alta liberada • Veterinário autorizador: ${vet}${notes.trim() ? ` • ${notes.trim()}` : ''}`,
    })

    onSaved?.(updated)
    onClose?.()
  }

  return (
    <div className="modal-backdrop">
      <section className="surgery-modal">
        <h2>LIBERAR ALTA</h2>
        <div className="animal-summary">
          <strong>Ficha nº {String(patient.number).padStart(3,'0')}</strong>
          <span>{patient.species} • {patient.sex}</span>
          <span>Tutor: {patient.tutorName || '-'}</span>
          <span>Procedimento: {(patient.procedures || []).join(' / ') || '-'}</span>
          <span>Veterinário do procedimento: {patient.veterinarian || '-'}</span>
        </div>

        <label className="modal-field">
          <span>Veterinário que autorizou a alta *</span>
          <select value={vet} onChange={e => setVet(e.target.value)}>
            <option value="">Selecione...</option>
            {vets.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="modal-field discharge-notes-field">
          <span>Observações da alta</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Digite observações importantes sobre a alta do paciente..."
          />
          <small>Estas observações ficarão visíveis para toda a equipe e serão lembradas na entrega.</small>
        </label>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="modal-secondary" onClick={onClose}>CANCELAR</button>
          <button className="modal-primary" onClick={save}>LIBERAR ALTA</button>
        </div>
      </section>
    </div>
  )
}
