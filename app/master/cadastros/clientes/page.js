'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ClientModal from '../../../../components/ClientModal'
import { buildClientsFromPatients, readClients, saveClients } from '../../../../components/clientUtils'
import { auditAction } from '../../../../components/auditUtils'

function readPatients() {
  try {
    const value = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [patients, setPatients] = useState([])

  useEffect(() => {
    let current = readClients()

    if (!current.length) {
      current = buildClientsFromPatients()
      if (current.length) saveClients(current)
    }

    setClients(current)
    setPatients(readPatients())
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients

    return clients.filter(client =>
      `${client.name} ${client.phone} ${client.cpf} ${client.email}`
        .toLowerCase()
        .includes(q)
    )
  }, [clients, query])

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
      details: `${exists ? 'Cliente editado' : 'Cliente cadastrado'} no CMS: ${client.name || '-'}`,
      metadata: { clientId: client.id, clientName: client.name || '' },
    })

    setClients(next)
    setEditing(null)
    setShowModal(false)
  }

  function removeClient(id) {
    const next = clients.filter(item => item.id !== id)
    saveClients(next)

    auditAction({
      action: exists ? 'CLIENTE_EDITADO' : 'CLIENTE_CADASTRADO',
      category: 'CLIENTE',
      details: `${exists ? 'Cliente editado' : 'Cliente cadastrado'} no CMS: ${client.name || '-'}`,
      metadata: { clientId: client.id, clientName: client.name || '' },
    })

    setClients(next)
  }

  function countAnimals(client) {
    return patients.filter(patient =>
      patient.clientId === client.id ||
      (!patient.clientId &&
        patient.tutorName?.trim().toLowerCase() === client.name.trim().toLowerCase())
    ).length
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS</span>
          <h1>CLIENTES / TUTORES</h1>
          <p>Cadastre, pesquise e edite os dados dos responsáveis pelos animais.</p>
        </div>

        <button
          className="cms-exit-button"
          onClick={() => router.push('/master/cadastros')}
        >
          ← VOLTAR
        </button>
      </header>

      <section className="cms-form-card">
        <div className="clients-toolbar">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, CPF ou e-mail..."
          />

          <button
            className="cms-primary-button"
            onClick={() => {
              setEditing(null)
              setShowModal(true)
            }}
          >
            + NOVO CLIENTE
          </button>
        </div>

        <div className="clients-table-wrap">
          <table className="cms-table clients-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>CPF</th>
                <th>E-mail</th>
                <th>Animais</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(client => (
                <tr key={client.id}>
                  <td><strong>{client.name}</strong></td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.cpf || '-'}</td>
                  <td>{client.email || '-'}</td>
                  <td>{countAnimals(client)}</td>
                  <td>
                    <div className="client-row-actions">
                      <button
                        className="client-edit-button"
                        onClick={() => {
                          setEditing(client)
                          setShowModal(true)
                        }}
                      >
                        EDITAR
                      </button>

                      <button
                        className="client-delete-button"
                        onClick={() => removeClient(client.id)}
                      >
                        EXCLUIR
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="cms-empty">Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <ClientModal
          client={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSave={saveClient}
        />
      )}
    </main>
  )
}
