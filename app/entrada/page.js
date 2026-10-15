'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneInput from '../../components/PhoneInput'
import ClientModal from '../../components/ClientModal'
import { buildClientsFromPatients, readClients, saveClients } from '../../components/clientUtils'
import { procedureDetailsForNames, readProcedureCatalog } from '../../components/procedureUtils'
import { auditAction, getCurrentActor } from '../../components/auditUtils'

function getCurrentPatientNumber() {
  if (typeof window === 'undefined') return 1
  const saved = Number(localStorage.getItem('deltaVetNextPatientNumber'))
  return Number.isFinite(saved) && saved > 0 ? saved : 1
}

export default function EntradaPage() {
  const router = useRouter()
  const [patientNumber, setPatientNumber] = useState(1)
  const [patientName, setPatientName] = useState('')
  const [species, setSpecies] = useState('')
  const [sex, setSex] = useState('')
  const [tutorName, setTutorName] = useState('')
  const [phone, setPhone] = useState('')
  const [tutorCpf, setTutorCpf] = useState('')
  const [tutorEmail, setTutorEmail] = useState('')
  const [weight, setWeight] = useState('')
  const [location, setLocation] = useState('')
  const [locationNumber, setLocationNumber] = useState('')
  const [procedure1, setProcedure1] = useState('')
  const [procedure2, setProcedure2] = useState('')
  const [procedure3, setProcedure3] = useState('')
  const [procedure4, setProcedure4] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [showClientModal, setShowClientModal] = useState(false)
  const [procedureOptions, setProcedureOptions] = useState([])

  useEffect(() => {
    setPatientNumber(getCurrentPatientNumber())

    try {
      let currentClients = readClients()
      if (!currentClients.length) {
        currentClients = buildClientsFromPatients()
        if (currentClients.length) saveClients(currentClients)
      }
      setClients(currentClients)
    } catch {}

    try {
      setProcedureOptions(readProcedureCatalog())
    } catch {}
  }, [])

  const formattedNumber = useMemo(
    () => String(patientNumber).padStart(3, '0'),
    [patientNumber]
  )

  function chooseSpecies(value) {
    setSpecies(value)
    if (value === 'FELINO') setWeight('')
  }

  function handleWeight(value) {
    setWeight(value.replace(/[^0-9,.]/g, '').replace('.', ',').slice(0, 7))
  }

  function chooseLocation(value) {
    setLocation(value)
    if (value === 'Caixa') {
      setLocationNumber(String(patientNumber).padStart(3, '0'))
    } else {
      setLocationNumber('')
    }
  }

  function selectClient(clientId) {
    setSelectedClientId(clientId)

    if (!clientId) {
      setTutorName('')
      setPhone('')
      setTutorCpf('')
      setTutorEmail('')
      return
    }

    const client = clients.find(item => item.id === clientId)
    if (!client) return

    setTutorName(client.name || '')
    setPhone(client.phone || '')
    setTutorCpf(client.cpf || '')
    setTutorEmail(client.email || '')
  }

  function saveClient(client) {
    const current = readClients()
    const exists = current.some(item => item.id === client.id)
    const next = exists
      ? current.map(item => item.id === client.id ? client : item)
      : [...current, client]

    saveClients(next)

    auditAction({
      action: exists ? 'CLIENTE_EDITADO' : 'CLIENTE_CADASTRADO',
      category: 'CLIENTE',
      details: `${exists ? 'Cliente editado' : 'Cliente cadastrado'}: ${client.name || '-'}`,
      metadata: { clientId: client.id, clientName: client.name || '' },
    })

    setClients(next)
    setSelectedClientId(client.id)
    setTutorName(client.name || '')
    setPhone(client.phone || '')
    setTutorCpf(client.cpf || '')
    setTutorEmail(client.email || '')
    setShowClientModal(false)
  }

  function submitPatient(e) {
    e.preventDefault()

    if (!species || !sex || !location || !tutorName.trim()) {
      setMessage('Preencha espécie, sexo, tutor e local internado.')
      return
    }

    if (location === 'Caixa' && !locationNumber.trim()) {
      setMessage('O número da Caixa é preenchido automaticamente pela ficha.')
      return
    }

    const createdAt = new Date().toISOString()
    const actor = getCurrentActor()

    const patient = {
      number: patientNumber,
      patientName: patientName.trim(),
      species,
      sex,
      tutorName: tutorName.trim(),
      phone,
      tutorCpf,
      tutorEmail,
      clientId: selectedClientId || null,
      weight,
      location,
      locationNumber: locationNumber.trim(),
      procedures: [procedure1, procedure2, procedure3, procedure4].filter(Boolean),
      procedureDetails: procedureDetailsForNames(
        [procedure1, procedure2, procedure3, procedure4].filter(Boolean),
        procedureOptions
      ),
      totalValue: procedureDetailsForNames(
        [procedure1, procedure2, procedure3, procedure4].filter(Boolean),
        procedureOptions
      ).reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      notes: notes.trim(),
      status: 'AGUARDANDO',
      surgeryExtras: [],
      confirmedAt: null,
      createdAt,
      _syncUpdatedAt: createdAt,
      createdBy: actor,
      updatedAt: null,
      timeline: [
        {
          type: 'ENTRADA_CRIADA',
          at: createdAt,
          actor,
          notes: 'Paciente cadastrado na entrada.',
        }
      ],
    }

    const stored = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    stored.push(patient)
    localStorage.setItem('deltaVetPatients', JSON.stringify(stored))

    auditAction({
      action: 'ENTRADA_CRIADA',
      category: 'PACIENTE',
      patient,
      actor,
      at: createdAt,
      details: `Entrada cadastrada • ${patient.location || '-'} ${patient.locationNumber || ''} • ${(patient.procedures || []).join(' / ') || 'Sem procedimento'}`,
    })


    const nextNumber = patientNumber + 1
    localStorage.setItem('deltaVetNextPatientNumber', String(nextNumber))
    setPatientNumber(nextNumber)

    setPatientName('')
    setSpecies('')
    setSex('')
    setWeight('')
    setLocation('')
    setLocationNumber('')
    setProcedure1('')
    setProcedure2('')
    setProcedure3('')
    setProcedure4('')
    setNotes('')
    setMessage(`Paciente nº ${formattedNumber} enviado com sucesso.`)
  }

  return (
    <main className="form-screen">
      <form className="entry-panel" onSubmit={submitPatient}>
        <header className="entry-topbar">
          <button type="button" className="back-arrow" onClick={() => router.push('/')} aria-label="Voltar">←</button>
          <div className="patient-number">Paciente nº {formattedNumber}</div>
        </header>

        <h1 className="form-title">CADASTRO DE ENTRADA</h1>

        <div className="patient-name-row">
          <label className="field-group">
            <span>Nome do paciente</span>
            <input
              className="field-input"
              value={patientName}
              onChange={e => setPatientName(e.target.value.slice(0, 60))}
              placeholder="Ex.: Thor, Mel, Sem nome..."
            />
          </label>

          <div className="patient-name-number-card">
            <small>Nº DO CADASTRO</small>
            <strong>{formattedNumber}</strong>
          </div>
        </div>

        <div className="species-grid">
          <button type="button" className={`select-button ${species === 'CANINO' ? 'active' : ''}`} onClick={() => chooseSpecies('CANINO')}>CANINO</button>
          <button type="button" className={`select-button ${species === 'FELINO' ? 'active' : ''}`} onClick={() => chooseSpecies('FELINO')}>FELINO</button>
        </div>

        <section className="section-block">
          <div className="section-label">Sexo</div>
          <div className="radio-row">
            {['Macho', 'Fêmea', 'Não sabe'].map((item) => (
              <label key={item} className="choice-label">
                <input type="radio" name="sex" checked={sex === item} onChange={() => setSex(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="two-col fields-two-col">
          <div className="field-group client-select-group">
            <span>Cliente / Tutor</span>

            <div className="client-select-row">
              <select
                className="field-input select-input"
                value={selectedClientId}
                onChange={e => selectClient(e.target.value)}
              >
                <option value="">Selecione um cliente cadastrado...</option>
                {clients
                  .slice()
                  .sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'))
                  .map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                className="new-client-button"
                onClick={() => setShowClientModal(true)}
              >
                + NOVO CLIENTE
              </button>
            </div>

            {selectedClientId && (
              <div className="selected-client-summary">
                <strong>{tutorName}</strong>
                <span>{phone || 'Sem telefone'}</span>
                <span>{tutorCpf || 'Sem CPF'}</span>
                <span>{tutorEmail || 'Sem e-mail'}</span>
              </div>
            )}
          </div>

          <label className="field-group">
            <span>Telefone do Tutor</span>
            <PhoneInput value={phone} onChange={setPhone} />
          </label>
        </div>

        <div className="entry-location-row">
          {species !== 'FELINO' ? (
            <label className="field-group">
              <span>Peso (kg)</span>
              <input
                className="field-input"
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 4,250"
                value={weight}
                onChange={(e) => handleWeight(e.target.value)}
              />
            </label>
          ) : (
            <div className="field-group feline-weight-rule">
              <span>Peso</span>
              <div className="feline-weight-message">Não necessário para felinos</div>
            </div>
          )}

          <div className="field-group">
            <span>Local Internado</span>
            <div className="radio-row location-row">
              {['Caixa', 'BOX'].map((item) => (
                <label key={item} className="choice-label">
                  <input type="radio" name="location" checked={location === item} onChange={() => chooseLocation(item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          {location && (
            <label className="field-group">
              <span>
                {location === 'Caixa'
                  ? 'Número da Caixa'
                  : 'Número do BOX (opcional)'}
              </span>
              <input
                className="field-input"
                type="text"
                inputMode="numeric"
                placeholder={location === 'Caixa' ? `Ficha ${formattedNumber}` : 'Ex.: 04'}
                value={locationNumber}
                                onChange={(e) =>
                  setLocationNumber(
                    e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 8)
                  )
                }
              />
              {location === 'Caixa' && (
                <small className="field-helper">
                  Sugestão automática pela ficha. Pode ser alterado.
                </small>
              )}
            </label>
          )}
        </div>

        <section className="procedures-grid">
          {[procedure1, procedure2, procedure3, procedure4].map((value, index) => {
            const setters = [setProcedure1, setProcedure2, setProcedure3, setProcedure4]
            return (
              <label className="field-group" key={index}>
                <span>Procedimento {index + 1}</span>
                <select className="field-input select-input" value={value} onChange={(e) => setters[index](e.target.value)}>
                  <option value="">Selecione...</option>
                  {procedureOptions.map((procedure) => <option value={procedure.name} key={procedure.id}>{procedure.name}</option>)}
                </select>
              </label>
            )
          })}
        </section>

        <label className="field-group notes-group">
          <span>Observações</span>
          <textarea className="field-input notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Digite alguma observação importante..." />
        </label>

        {message && <div className="inline-message">{message}</div>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => router.push('/')}>VOLTAR</button>
          <button type="submit" className="primary-button">ENVIAR</button>
        </div>
      </form>

      {showClientModal && (
        <ClientModal
          onClose={() => setShowClientModal(false)}
          onSave={saveClient}
        />
      )}

    </main>
  )
}
