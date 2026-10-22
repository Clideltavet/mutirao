'use client'
import { patientRecordKey, patientRouteId } from '../../components/syncUtils'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auditAction, getCurrentActor } from '../../components/auditUtils'

function readPatients() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function localDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function SaidaPage() {
  const router = useRouter()
  const [patients, setPatients] = useState([])
  const [tab, setTab] = useState('ALTA')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [revertNotes, setRevertNotes] = useState('')
  const [internLocation, setInternLocation] = useState('')
  const [internNumber, setInternNumber] = useState('')
  const [internNotes, setInternNotes] = useState('')

  function refresh(updated) {
    setPatients(updated || readPatients())
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(() => refresh(), 1000)
    const onStorage = e => e.key === 'deltaVetPatients' && refresh()
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const today = localDateKey()
  const todayPatients = useMemo(
    () => patients.filter(p => localDateKey(p.createdAt) === today),
    [patients, today]
  )

  const counts = useMemo(() => ({
    INTERNADOS: todayPatients.filter(p => p.status === 'CONFIRMADO' && !p.dischargeStatus).length,
    ALTA: todayPatients.filter(p => p.dischargeStatus === 'ALTA').length,
    ENTREGUES: todayPatients.filter(p => p.dischargeStatus === 'ENTREGUE').length,
  }), [todayPatients])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return todayPatients
      .filter(p => {
        if (tab === 'INTERNADOS') return p.status === 'CONFIRMADO' && !p.dischargeStatus
        if (tab === 'ALTA') return p.dischargeStatus === 'ALTA'
        return p.dischargeStatus === 'ENTREGUE'
      })
      .filter(p => !q || `${p.number} ${p.tutorName} ${p.species} ${(p.procedures||[]).join(' ')}`.toLowerCase().includes(q))
  }, [todayPatients, tab, query])

  function persistPatch(number, patch, event) {
    const all = readPatients()
    const actor = getCurrentActor()
    const timelineEvent = { ...event, actor }

    const updated = all.map(p =>
      patientRecordKey(p) === number
        ? {
            ...p,
            ...patch,
            _syncUpdatedAt: event.at || new Date().toISOString(),
            timeline: [
              ...(Array.isArray(p.timeline) ? p.timeline : []),
              timelineEvent,
            ],
          }
        : p
    )

    localStorage.setItem('deltaVetPatients', JSON.stringify(updated))

    const savedPatient = updated.find(p => patientRecordKey(p) === number)
    const detailsMap = {
      ENTREGUE: `Entrega confirmada${event.notes ? ` • ${event.notes}` : ''}`,
      ALTA_CANCELADA: `Alta cancelada e paciente retornou ao pós-operatório${event.notes ? ` • ${event.notes}` : ''}`,
      REINTERNADO_APOS_ENTREGA: `Paciente reinternado em ${event.location || '-'} ${event.locationNumber || ''}${event.notes ? ` • ${event.notes}` : ''}`,
    }

    auditAction({
      action: event.type,
      category: 'SAIDA',
      patient: savedPatient,
      actor,
      at: event.at,
      details: detailsMap[event.type] || event.notes || '',
    })

    refresh(updated)
  }

  function openPatient(patient) {
    setSelected(patient)
    setAction('DETAIL')
    setDeliveryNotes(patient.deliveryNotes || '')
    setRevertNotes('')
  }

  function confirmDelivery() {
    if (!selected) return
    const at = new Date().toISOString()

    persistPatch(
      patientRecordKey(selected),
      {
        dischargeStatus: 'ENTREGUE',
        deliveredAt: at,
        deliveryNotes: deliveryNotes.trim(),
      },
      {
        type: 'ENTREGUE',
        at,
        notes: deliveryNotes.trim(),
      }
    )

    setSelected(null)
    setAction('')
    setDeliveryNotes('')
    setTab('ENTREGUES')
  }

  function revertToInterned() {
    if (!selected) return
    const at = new Date().toISOString()

    persistPatch(
      patientRecordKey(selected),
      {
        dischargeStatus: null,
        dischargedAt: null,
        dischargeVeterinarian: null,
        dischargeNotes: null,
        returnedToInternedAt: at,
        returnedToInternedNotes: revertNotes.trim(),
      },
      {
        type: 'ALTA_CANCELADA',
        at,
        notes: revertNotes.trim(),
      }
    )

    setSelected(null)
    setAction('')
    setRevertNotes('')
    setTab('INTERNADOS')
  }


  function internDeliveredPatient() {
    if (!selected || !internLocation || !internNumber.trim()) return
    const at = new Date().toISOString()

    persistPatch(
      patientRecordKey(selected),
      {
        dischargeStatus: null,
        deliveredAt: null,
        deliveryNotes: null,
        location: internLocation,
        locationNumber: internNumber.trim(),
        reinternedAt: at,
        reinternedNotes: internNotes.trim(),
      },
      {
        type: 'REINTERNADO_APOS_ENTREGA',
        at,
        location: internLocation,
        locationNumber: internNumber.trim(),
        notes: internNotes.trim(),
      }
    )

    setSelected(null)
    setAction('')
    setInternLocation('')
    setInternNumber('')
    setInternNotes('')
    setTab('INTERNADOS')
  }

  return (
    <main className="exit-screen">
      <header className="exit-header">
        <button className="back-arrow" onClick={() => router.push('/')}>←</button>
        <div>
          <h1>SAÍDA</h1>
          <div className="panel-current-date">{new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </header>

      <section className="exit-tabs">
        <button className={tab === 'INTERNADOS' ? 'active' : ''} onClick={() => setTab('INTERNADOS')}>
          PÓS-OP <b>{counts.INTERNADOS}</b>
        </button>
        <button className={tab === 'ALTA' ? 'active' : ''} onClick={() => setTab('ALTA')}>
          DE ALTA <b>{counts.ALTA}</b>
        </button>
        <button className={tab === 'ENTREGUES' ? 'active' : ''} onClick={() => setTab('ENTREGUES')}>
          ENTREGUES <b>{counts.ENTREGUES}</b>
        </button>
      </section>

      <div className="exit-search">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por tutor, ficha, espécie ou procedimento..."
        />
      </div>

      <section className="exit-list">
        {filtered.length === 0 ? (
          <div className="exit-empty">Nenhum animal nesta situação hoje.</div>
        ) : filtered.map(p => (
          <article
            className="exit-card exit-card-clickable"
            key={`${p.number}-${p.createdAt}`}
            onClick={() => openPatient(p)}
          >
            <div className="exit-card-main">
              <div className="exit-number">Nº {String(p.number).padStart(3,'0')}</div>
              <div className="exit-animal-icon">{p.species === 'FELINO' ? '🐱' : '🐶'}</div>
              <div className="exit-details">
                <strong>{p.species || 'ANIMAL'} • {p.sex || '-'}</strong>
                <span>Tutor: {p.tutorName || '-'}</span>
                <span>{p.location || '-'} {p.locationNumber || ''}</span>
                <span>{(p.procedures || []).join(' • ') || 'Sem procedimento informado'}</span>
              </div>
            </div>

            <div className="exit-status-area">
              {p.status === 'CONFIRMADO' && !p.dischargeStatus && (
                <>
                  <span className="status-pill interned">PÓS-OP</span>
                  <small>Aguardando liberação de alta</small>
                </>
              )}

              {p.dischargeStatus === 'ALTA' && (
                <>
                  <span className="status-pill discharge">✓ DE ALTA</span>
                  <small>Alta às {formatTime(p.dischargedAt)}</small>
                  <button onClick={e => { e.stopPropagation(); openPatient(p); setAction('ENTREGAR') }}>
                    ENTREGAR
                  </button>
                </>
              )}

              {p.dischargeStatus === 'ENTREGUE' && (
                <>
                  <span className="status-pill delivered">✓ ENTREGUE</span>
                  <small>Entregue às {formatTime(p.deliveredAt)}</small>
                </>
              )}
            </div>
          </article>
        ))}
      </section>

      {selected && action === 'DETAIL' && (
        <div className="modal-backdrop">
          <section className="surgery-modal exit-detail-modal">
            <h2>ANIMAL</h2>

            <div className="animal-summary">
              <strong>Ficha nº {String(selected.number).padStart(3,'0')}</strong>
              <span>{selected.species} • {selected.sex}{selected.weight ? ` • ${selected.weight} kg` : ''}</span>
              <span>Tutor: {selected.tutorName || '-'}</span>
              <span>{selected.location || '-'} {selected.locationNumber || ''}</span>
              <span>Procedimento: {(selected.procedures || []).join(' / ') || '-'}</span>
              <span>Veterinário: {selected.veterinarian || '-'}</span>
            </div>

            <div className="exit-detail-status">
              {selected.status === 'CONFIRMADO' && !selected.dischargeStatus && (
                <span className="status-pill interned">PÓS-OP / AGUARDANDO ALTA</span>
              )}
              {selected.dischargeStatus === 'ALTA' && (
                <span className="status-pill discharge">✓ DE ALTA</span>
              )}
              {selected.dischargeStatus === 'ENTREGUE' && (
                <span className="status-pill delivered">✓ ENTREGUE</span>
              )}
            </div>

            <div className="exit-detail-actions">
              <button className="modal-secondary" onClick={() => router.push(`/pacientes/${patientRouteId(selected)}/editar`)}>
                EDITAR PACIENTE
              </button>

              {selected.dischargeStatus === 'ALTA' && (
                <>
                  <button className="reintern-button" onClick={() => setAction('REINTERNAR')}>
                    VOLTAR PARA INTERNADO
                  </button>
                  <button className="modal-primary" onClick={() => setAction('ENTREGAR')}>
                    ENTREGAR
                  </button>
                </>
              )}

              {selected.dischargeStatus === 'ENTREGUE' && (
                <button
                  className="reintern-button"
                  onClick={() => {
                    setInternLocation(selected.location || '')
                    setInternNumber(selected.locationNumber || '')
                    setInternNotes('')
                    setAction('INTERNAR_ENTREGUE')
                  }}
                >
                  INTERNAR
                </button>
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-secondary" onClick={() => { setSelected(null); setAction('') }}>
                FECHAR
              </button>
            </div>
          </section>
        </div>
      )}

      {selected && action === 'ENTREGAR' && (
        <div className="modal-backdrop">
          <section className="surgery-modal">
            <h2>CONFIRMAR ENTREGA</h2>

            <div className="animal-summary">
              <strong>Ficha nº {String(selected.number).padStart(3,'0')}</strong>
              <span>Tutor: {selected.tutorName || '-'}</span>
              <span>Alta às {formatTime(selected.dischargedAt)}</span>
              <span>Veterinário da alta: {selected.dischargeVeterinarian || '-'}</span>
            </div>

            <div className="delivery-reminder">
              <strong>LEMBRETES PARA A ENTREGA</strong>
              <div>
                <span>Entrada</span>
                <p>{selected.notes || 'Sem observações.'}</p>
              </div>
              <div>
                <span>Procedimento</span>
                <p>{selected.surgeryNotes || 'Sem observações.'}</p>
              </div>
              <div className="delivery-reminder-highlight">
                <span>Alta</span>
                <p>{selected.dischargeNotes || 'Sem observações da alta.'}</p>
              </div>
            </div>

            <label className="modal-field">
              <span>Observação da entrega</span>
              <textarea
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                placeholder="Ex.: entregue à tutora, orientações reforçadas, medicação explicada..."
              />
            </label>

            <p className="final-question">Confirma que o animal foi entregue ao responsável?</p>

            <div className="modal-actions">
              <button className="modal-secondary" onClick={() => setAction('DETAIL')}>VOLTAR</button>
              <button className="modal-primary" onClick={confirmDelivery}>CONFIRMAR ENTREGA</button>
            </div>
          </section>
        </div>
      )}

      {selected && action === 'REINTERNAR' && (
        <div className="modal-backdrop">
          <section className="surgery-modal">
            <h2>VOLTAR PARA INTERNADO</h2>

            <div className="animal-summary">
              <strong>Ficha nº {String(selected.number).padStart(3,'0')}</strong>
              <span>{selected.species} • {selected.sex}</span>
              <span>Tutor: {selected.tutorName || '-'}</span>
            </div>

            <label className="modal-field">
              <span>Motivo / observação</span>
              <textarea
                value={revertNotes}
                onChange={e => setRevertNotes(e.target.value)}
                placeholder="Informe por que a alta está sendo cancelada..."
              />
            </label>

            <p className="final-question">
              O paciente voltará para PÓS-OP / aguardando nova liberação de alta.
            </p>

            <div className="modal-actions">
              <button className="modal-secondary" onClick={() => setAction('DETAIL')}>CANCELAR</button>
              <button className="reintern-confirm" onClick={revertToInterned}>CONFIRMAR RETORNO</button>
            </div>
          </section>
        </div>
      )}

      {selected && action === 'INTERNAR_ENTREGUE' && (
        <div className="modal-backdrop">
          <section className="surgery-modal">
            <h2>INTERNAR PACIENTE</h2>

            <div className="animal-summary">
              <strong>Ficha nº {String(selected.number).padStart(3,'0')}</strong>
              <span>{selected.species} • {selected.sex}</span>
              <span>Tutor: {selected.tutorName || '-'}</span>
              <span>Paciente anteriormente marcado como entregue.</span>
            </div>

            <div className="intern-location-grid">
              <div className="field-group">
                <span>Local Internado</span>
                <div className="radio-row location-row">
                  {['Caixa', 'BOX'].map(item => (
                    <label className="choice-label" key={item}>
                      <input
                        type="radio"
                        name="internLocation"
                        checked={internLocation === item}
                        onChange={() => {
                          setInternLocation(item)
                          setInternNumber('')
                        }}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="field-group">
                <span>{internLocation ? `Qual ${internLocation}?` : 'Nº Caixa / BOX'}</span>
                <input
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  disabled={!internLocation}
                  value={internNumber}
                  onChange={e => setInternNumber(e.target.value.replace(/[^0-9A-Za-z-]/g,'').slice(0,8))}
                  placeholder={internLocation ? 'Ex.: 04' : 'Selecione o local'}
                />
              </label>
            </div>

            <label className="modal-field">
              <span>Observação da internação</span>
              <textarea
                value={internNotes}
                onChange={e => setInternNotes(e.target.value)}
                placeholder="Motivo ou observação..."
              />
            </label>

            <p className="final-question">
              O paciente voltará para a lista de internados/pós-operatório.
            </p>

            <div className="modal-actions">
              <button className="modal-secondary" onClick={() => setAction('DETAIL')}>
                CANCELAR
              </button>
              <button
                className="modal-primary"
                disabled={!internLocation || !internNumber.trim()}
                onClick={internDeliveredPatient}
              >
                CONFIRMAR INTERNAÇÃO
              </button>
            </div>
          </section>
        </div>
      )}

    </main>
  )
}
