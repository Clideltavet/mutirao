'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ClientModal from '../../../../components/ClientModal'
import { buildClientsFromPatients, readClients, saveClients } from '../../../../components/clientUtils'
import { auditAction } from '../../../../components/auditUtils'
import { clientRecordKey, queueSyncDelete } from '../../../../components/syncUtils'

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

    return clients
      .filter(client => {
        if (!q) return true
        return `${client.name} ${client.phone} ${client.cpf} ${client.email}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a,b) => {
        if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
      })
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

  function persistClients(next) {
    saveClients(next)
    setClients(next)
  }

  function archiveClient(client) {
    const linked = countAnimals(client)
    if (!window.confirm(
      linked
        ? `Este tutor possui ${linked} registro(s) de animal vinculado(s). Arquivar o tutor mantém todo o histórico. Deseja continuar?`
        : 'Arquivar este tutor?'
    )) return

    const at = new Date().toISOString()
    const next = clients.map(item =>
      item.id === client.id
        ? { ...item, archived: true, archivedAt: at, updatedAt: at, _syncUpdatedAt: at }
        : item
    )

    persistClients(next)
    auditAction({
      action: 'CLIENTE_ARQUIVADO',
      category: 'CLIENTE',
      details: `Tutor arquivado: ${client.name || '-'} • ${linked} registro(s) vinculado(s)`,
      metadata: { clientId: client.id, clientName: client.name || '', linkedPatients: linked },
    })
  }

  function reactivateClient(client) {
    const at = new Date().toISOString()
    const next = clients.map(item =>
      item.id === client.id
        ? { ...item, archived: false, archivedAt: null, updatedAt: at, _syncUpdatedAt: at }
        : item
    )

    persistClients(next)
    auditAction({
      action: 'CLIENTE_REATIVADO',
      category: 'CLIENTE',
      details: `Tutor reativado: ${client.name || '-'}`,
      metadata: { clientId: client.id, clientName: client.name || '' },
    })
  }

  function removeClient(client) {
    const linked = countAnimals(client)

    if (linked > 0) {
      const first = window.confirm(
        `ATENÇÃO: ${client.name} possui ${linked} registro(s) de animal vinculado(s).

Excluir o cadastro do tutor NÃO apagará esses animais nem o histórico.

Deseja continuar?`
      )
      if (!first) return

      const confirmation = window.prompt('Para excluir somente o cadastro do tutor, digite EXCLUIR:')
      if (String(confirmation || '').trim().toUpperCase() !== 'EXCLUIR') return
    } else {
      if (!window.confirm(`Excluir o tutor ${client.name}?`)) return
    }

    queueSyncDelete('clients', clientRecordKey(client))
    const next = clients.filter(item => item.id !== client.id)
    persistClients(next)

    auditAction({
      action: 'CLIENTE_EXCLUIDO',
      category: 'CLIENTE',
      details: `Cadastro do tutor excluído: ${client.name || '-'} • histórico dos animais preservado • ${linked} registro(s) vinculado(s)`,
      metadata: { clientId: client.id, clientName: client.name || '', linkedPatients: linked },
    })
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
                  <td>
                    <strong>{client.name}</strong>
                    {client.archived && <span className="client-archived-badge">ARQUIVADO</span>}
                  </td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.cpf || '-'}</td>
                  <td>{client.email || '-'}</td>
                  <td>{countAnimals(client)}</td>
                  <td>
                    <div className="client-row-actions">
                      {!client.archived && (
                        <button
                          className="client-edit-button"
                          onClick={() => {
                            setEditing(client)
                            setShowModal(true)
                          }}
                        >
                          EDITAR
                        </button>
                      )}

                      {client.archived ? (
                        <button
                          className="client-reactivate-button"
                          onClick={() => reactivateClient(client)}
                        >
                          REATIVAR
                        </button>
                      ) : countAnimals(client) > 0 ? (
                        <button
                          className="client-archive-button"
                          onClick={() => archiveClient(client)}
                        >
                          ARQUIVAR
                        </button>
                      ) : null}

                      <button
                        className="client-delete-button"
                        onClick={() => removeClient(client)}
                      >
                        {countAnimals(client) > 0 ? 'EXCLUIR CADASTRO' : 'EXCLUIR'}
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
