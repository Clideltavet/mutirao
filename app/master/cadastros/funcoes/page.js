'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACCESS_OPTIONS, DEFAULT_ROLES, readRoles, saveRoles } from '../../../../components/roleUtils'

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [accesses, setAccesses] = useState([])
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    const current = readRoles()
    setRoles(current)
    saveRoles(current)
  }, [])

  function persist(next) {
    setRoles(next)
    saveRoles(next)
  }

  function toggle(access) {
    setAccesses(current =>
      current.includes(access)
        ? current.filter(item => item !== access)
        : [...current, access]
    )
  }

  function resetForm() {
    setName('')
    setDescription('')
    setAccesses([])
    setEditing(null)
  }

  function saveRole() {
    const cleanName = name.trim()
    if (!cleanName || accesses.length === 0) return

    if (editing) {
      persist(roles.map(role =>
        role.id === editing
          ? { ...role, name: cleanName, description: description.trim(), accesses }
          : role
      ))
    } else {
      persist([
        ...roles,
        {
          id: `role-${Date.now()}`,
          name: cleanName,
          description: description.trim(),
          accesses,
        }
      ])
    }

    resetForm()
  }

  function startEdit(role) {
    setEditing(role.id)
    setName(role.name)
    setDescription(role.description || '')
    setAccesses(role.accesses || [])
  }

  function removeRole(id) {
    persist(roles.filter(role => role.id !== id))
    if (editing === id) resetForm()
  }

  function restoreDefaults() {
    persist(DEFAULT_ROLES)
    resetForm()
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS</span>
          <h1>FUNÇÕES E PERMISSÕES</h1>
          <p>Crie funções prontas e defina exatamente quais telas cada função pode acessar.</p>
        </div>

        <button className="cms-exit-button" onClick={() => router.push('/master/cadastros')}>
          ← VOLTAR
        </button>
      </header>

      <section className="cms-form-card">
        <div className="role-form-grid">
          <label>
            <span>Nome da função</span>
            <input
              value={name}
              onChange={e => setName(e.target.value.slice(0,60))}
              placeholder="Ex.: Recepção"
            />
          </label>

          <label>
            <span>Descrição</span>
            <input
              value={description}
              onChange={e => setDescription(e.target.value.slice(0,120))}
              placeholder="O que esta função faz?"
            />
          </label>
        </div>

        <div className="access-box">
          <strong>Telas permitidas</strong>
          <div className="access-grid">
            {ACCESS_OPTIONS.map(([id,label]) => (
              <label className="access-check" key={id}>
                <input
                  type="checkbox"
                  checked={accesses.includes(id)}
                  onChange={() => toggle(id)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="role-form-actions">
          <button className="cms-primary-button" onClick={saveRole}>
            {editing ? 'SALVAR FUNÇÃO' : 'CADASTRAR FUNÇÃO'}
          </button>

          {editing && (
            <button className="cms-neutral-button" onClick={resetForm}>
              CANCELAR EDIÇÃO
            </button>
          )}

          <button className="cms-neutral-button" onClick={restoreDefaults}>
            RESTAURAR PADRÕES
          </button>
        </div>

        <div className="role-list">
          {roles.map(role => (
            <div className="role-card" key={role.id}>
              <div className="role-card-head">
                <div>
                  <strong>{role.name}</strong>
                  <p>{role.description || 'Sem descrição.'}</p>
                </div>
                <div className="role-card-actions">
                  <button className="client-edit-button" onClick={() => startEdit(role)}>EDITAR</button>
                  <button className="client-delete-button" onClick={() => removeRole(role.id)}>EXCLUIR</button>
                </div>
              </div>

              <div className="role-access-tags">
                {(role.accesses || []).map(access => {
                  const label = ACCESS_OPTIONS.find(([id]) => id === access)?.[1] || access
                  return <span key={access}>{label}</span>
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
