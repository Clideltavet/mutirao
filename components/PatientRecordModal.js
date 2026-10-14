'use client'

import { currencyBRL, patientProcedureDetails, patientTotalValue } from './procedureUtils'

function dateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('pt-BR')
}

const EVENT_LABELS = {
  ENTRADA_CRIADA: 'Entrada cadastrada',
  PACIENTE_EDITADO: 'Cadastro do paciente editado',
  CIRURGIA_CONFIRMADA: 'Cirurgia confirmada',
  ALTA: 'Alta liberada',
  ENTREGUE: 'Paciente entregue',
  ALTA_CANCELADA: 'Alta cancelada / retorno ao pós-op',
  REINTERNADO_APOS_ENTREGA: 'Paciente reinternado',
}

export default function PatientRecordModal({ patient, onClose, showValues = false }) {
  if (!patient) return null

  const details = patientProcedureDetails(patient)
  const total = patientTotalValue(patient)

  return (
    <div className="modal-backdrop">
      <section className="surgery-modal patient-record-modal">
        <div className="record-modal-head">
          <div>
            <span className="record-kicker">PRONTUÁRIO / ANAMNESE</span>
            <h2>{patient.patientName || 'Paciente sem nome'} • Ficha {String(patient.number || '').padStart(3,'0')}</h2>
          </div>
          <button className="record-close-button" onClick={onClose}>✕</button>
        </div>

        <div className="record-status-line">
          <span>{patient.species || '-'}</span>
          <span>{patient.sex || '-'}</span>
          <span>{patient.weight ? `${patient.weight} kg` : 'Peso não informado'}</span>
          <span>{patient.location || '-'} {patient.locationNumber || ''}</span>
        </div>

        <section className="record-grid">
          <div>
            <small>TUTOR</small>
            <strong>{patient.tutorName || '-'}</strong>
            <span>{patient.phone || '-'}</span>
            <span>{patient.tutorCpf || '-'}</span>
            <span>{patient.tutorEmail || '-'}</span>
          </div>

          <div>
            <small>DATAS</small>
            <strong>Entrada: {dateTime(patient.createdAt)}</strong>
            <span>Cirurgia: {dateTime(patient.confirmedAt)}</span>
            <span>Alta: {dateTime(patient.dischargedAt)}</span>
            <span>Entrega: {dateTime(patient.deliveredAt)}</span>
          </div>

          <div>
            <small>VETERINÁRIOS</small>
            <strong>Procedimento: {patient.veterinarian || 'Não informado'}</strong>
            <span>Alta: {patient.dischargeVeterinarian || 'Não informado'}</span>
          </div>
        </section>

        <section className="record-section">
          <h3>Procedimentos realizados</h3>
          <div className="record-procedure-list">
            {details.length ? details.map((item, index) => (
              <div className="record-procedure-row" key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                {showValues && <strong>{currencyBRL(item.value)}</strong>}
              </div>
            )) : <div className="record-empty">Nenhum procedimento registrado.</div>}
          </div>
          {showValues && (
            <div className="record-total-value">
              <span>Valor total do atendimento</span>
              <strong>{currencyBRL(total)}</strong>
            </div>
          )}
        </section>

        <section className="record-notes-grid">
          <div>
            <small>OBSERVAÇÃO DA ENTRADA</small>
            <p>{patient.notes || 'Sem observações.'}</p>
          </div>
          <div>
            <small>OBSERVAÇÃO DO PROCEDIMENTO</small>
            <p>{patient.surgeryNotes || 'Sem observações.'}</p>
          </div>
          <div>
            <small>OBSERVAÇÃO DA ALTA</small>
            <p>{patient.dischargeNotes || 'Sem observações.'}</p>
          </div>
          <div>
            <small>OBSERVAÇÃO DA ENTREGA</small>
            <p>{patient.deliveryNotes || 'Sem observações.'}</p>
          </div>
        </section>

        <section className="record-section">
          <h3>Informações cirúrgicas</h3>
          <div className="record-tags">
            {(patient.surgeryExtras || []).length
              ? patient.surgeryExtras.map(item => <span key={item}>{item}</span>)
              : <span className="record-tag-muted">Nenhum adicional marcado</span>}
          </div>
        </section>

        <section className="record-section">
          <h3>Linha do tempo</h3>
          <div className="record-timeline">
            <div className="record-timeline-item">
              <strong>Entrada</strong>
              <span>{dateTime(patient.createdAt)}</span>
            </div>

            {(patient.timeline || []).map((event, index) => (
              <div className="record-timeline-item" key={`${event.type}-${event.at}-${index}`}>
                <strong>{EVENT_LABELS[event.type] || event.type}</strong>
                <span>{dateTime(event.at)}</span>
                {event.actor?.name && (
                  <small className="record-actor">Feito por: {event.actor.name}{event.actor.username ? ` (@${event.actor.username})` : ''}</small>
                )}
                {event.veterinarian && <small>Veterinário: {event.veterinarian}</small>}
                {event.notes && <small>{event.notes}</small>}
              </div>
            ))}
          </div>
        </section>

        <div className="modal-actions">
          <button className="modal-primary" onClick={onClose}>FECHAR</button>
        </div>
      </section>
    </div>
  )
}
