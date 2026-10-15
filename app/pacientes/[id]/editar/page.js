'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PhoneInput from '../../../../components/PhoneInput'
import { procedureDetailsForNames, readProcedureCatalog } from '../../../../components/procedureUtils'
import { auditAction, getCurrentActor } from '../../../../components/auditUtils'

export default function EditPatientPage() {
  const params = useParams()
  const router = useRouter()
  const number = Number(params.id)
  const [p, setP] = useState(null)
  const [message, setMessage] = useState('')
  const [procedureOptions, setProcedureOptions] = useState([])

  useEffect(() => {
    const at = new Date().toISOString()
    const actor = getCurrentActor()
    const all = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    const found = all.find(x => Number(x.number) === number)
    if (found) setP({...found, procedures: [...(found.procedures || []), '', '', '', ''].slice(0,4)})
    setProcedureOptions(readProcedureCatalog())
  }, [number])

  if (!p) return <main className="form-screen"><div className="entry-panel">Paciente não encontrado.</div></main>

  function setField(key, value) { setP(cur => ({...cur, [key]: value})) }
  function setProcedure(index, value) {
    const next = [...p.procedures]; next[index] = value
    setP({...p, procedures: next})
  }
  function save(e) {
    e.preventDefault()
    const at = new Date().toISOString()
    const actor = getCurrentActor()
    const all = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    const updated = all.map(x => Number(x.number) === number ? {
      ...p,
      procedures: p.procedures.filter(Boolean),
      procedureDetails: procedureDetailsForNames(p.procedures.filter(Boolean), procedureOptions),
      totalValue: procedureDetailsForNames(p.procedures.filter(Boolean), procedureOptions)
        .reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      updatedAt: at,
      _syncUpdatedAt: at,
      updatedBy: actor,
      timeline: [
        ...(Array.isArray(x.timeline) ? x.timeline : []),
        { type: 'PACIENTE_EDITADO', at, actor, notes: 'Dados cadastrais do paciente alterados.' }
      ]
    } : x)
    localStorage.setItem('deltaVetPatients', JSON.stringify(updated))

    const savedPatient = updated.find(x => Number(x.number) === number)
    auditAction({
      action: 'PACIENTE_EDITADO',
      category: 'PACIENTE',
      patient: savedPatient,
      actor,
      at,
      details: 'Dados cadastrais do paciente foram alterados.',
    })

    setMessage('Alterações salvas.')
    setTimeout(() => router.push(`/pacientes/${number}`), 500)
  }

  return (
    <main className="form-screen">
      <form className="entry-panel" onSubmit={save}>
        <header className="entry-topbar">
          <button type="button" className="back-arrow" onClick={() => router.push(`/pacientes/${number}`)}>←</button>
          <div className="patient-number">Paciente nº {String(p.number).padStart(3,'0')}</div>
        </header>

        <h1 className="form-title">EDITAR PACIENTE</h1>

        <label className="field-group patient-edit-name">
          <span>Nome do paciente</span>
          <input
            className="field-input"
            value={p.patientName || ''}
            onChange={e => setField('patientName', e.target.value.slice(0,60))}
            placeholder="Nome do paciente"
          />
        </label>

        {p.status === 'CONFIRMADO' && <div className="confirmed-edit-warning">✓ Este paciente já foi confirmado pela cirurgia. Alterações feitas aqui serão posteriores à confirmação.</div>}

        <div className="species-grid">
          {['CANINO','FELINO'].map(x => <button key={x} type="button" className={`select-button ${p.species === x ? 'active' : ''}`} onClick={() => setField('species', x)}>{x}</button>)}
        </div>

        <section className="section-block">
          <div className="section-label">Sexo</div>
          <div className="radio-row">
            {['Macho','Fêmea','Não sabe'].map(x => <label className="choice-label" key={x}><input type="radio" checked={p.sex === x} onChange={() => setField('sex', x)} /><span>{x}</span></label>)}
          </div>
        </section>

        <div className="two-col fields-two-col">
          <label className="field-group"><span>Nome do Tutor</span><input className="field-input" value={p.tutorName || ''} onChange={e => setField('tutorName', e.target.value)} /></label>
          <label className="field-group"><span>Telefone do Tutor</span><PhoneInput value={p.phone || ''} onChange={v => setField('phone', v)} /></label>
        </div>

        <div className="entry-location-row">
          {p.species !== 'FELINO' ? (
            <label className="field-group"><span>Peso (kg)</span><input className="field-input" inputMode="decimal" value={p.weight || ''} onChange={e => setField('weight', e.target.value.replace(/[^0-9,.]/g,''))} /></label>
          ) : (
            <div className="field-group feline-weight-rule"><span>Peso</span><div className="feline-weight-message">Não necessário para felinos</div></div>
          )}
          <div className="field-group"><span>Local Internado</span><div className="radio-row location-row">
            {['Caixa','BOX'].map(x => <label className="choice-label" key={x}><input type="radio" checked={p.location === x} onChange={() => {setField('location',x); setField('locationNumber','')}} /><span>{x}</span></label>)}
          </div></div>
          <label className="field-group"><span>{p.location ? `Qual ${p.location}?` : 'Nº Caixa / BOX'}</span><input className="field-input" value={p.locationNumber || ''} onChange={e => setField('locationNumber', e.target.value)} /></label>
        </div>

        <section className="procedures-grid">
          {p.procedures.map((value,index) => <label className="field-group" key={index}>
            <span>Procedimento {index+1}</span>
            <select className="field-input select-input" value={value} onChange={e => setProcedure(index,e.target.value)}>
              <option value="">Selecione...</option>
              {procedureOptions.map(x => <option value={x.name} key={x.id}>{x.name}</option>)}
            </select>
          </label>)}
        </section>

        <label className="field-group notes-group"><span>Observações</span><textarea className="field-input notes-input" value={p.notes || ''} onChange={e => setField('notes',e.target.value)} /></label>

        {message && <div className="inline-message">{message}</div>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => router.push(`/pacientes/${number}`)}>CANCELAR</button>
          <button type="submit" className="primary-button">SALVAR ALTERAÇÕES</button>
        </div>
      </form>
    </main>
  )
}
