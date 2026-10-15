'use client'

import { useEffect, useState } from 'react'
import { formatCpf, normalizeEmail } from './clientUtils'
import PhoneInput from './PhoneInput'

export default function ClientModal({ client, onClose, onSave }) {
  const [name, setName] = useState(client?.name || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [cpf, setCpf] = useState(client?.cpf || '')
  const [email, setEmail] = useState(client?.email || '')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(client?.name || '')
    setPhone(client?.phone || '')
    setCpf(client?.cpf || '')
    setEmail(client?.email || '')
  }, [client])

  function save() {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Informe o nome do cliente/tutor.')
      return
    }

    const data = {
      ...client,
      id: client?.id || `client-${Date.now()}`,
      name: cleanName.slice(0, 80),
      phone,
      cpf: formatCpf(cpf),
      email: normalizeEmail(email),
      createdAt: client?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _syncUpdatedAt: new Date().toISOString(),
    }

    onSave(data)
  }

  return (
    <div className="modal-backdrop">
      <section className="surgery-modal client-modal">
        <h2>{client ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}</h2>

        <div className="client-form-grid">
          <label className="modal-field">
            <span>Nome completo *</span>
            <input
              value={name}
              onChange={e => setName(e.target.value.slice(0, 80))}
              placeholder="Nome do tutor"
            />
          </label>

          <label className="modal-field">
            <span>Telefone / WhatsApp</span>
            <PhoneInput value={phone} onChange={setPhone} />
          </label>

          <label className="modal-field">
            <span>CPF</span>
            <input
              value={cpf}
              inputMode="numeric"
              onChange={e => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </label>

          <label className="modal-field">
            <span>E-mail</span>
            <input
              value={email}
              type="email"
              onChange={e => setEmail(normalizeEmail(e.target.value))}
              placeholder="cliente@email.com"
            />
          </label>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="modal-secondary" type="button" onClick={onClose}>
            CANCELAR
          </button>
          <button className="modal-primary" type="button" onClick={save}>
            SALVAR CLIENTE
          </button>
        </div>
      </section>
    </div>
  )
}
