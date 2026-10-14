'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACCESS_OPTIONS } from '../../../../components/roleUtils'

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [accesses, setAccesses] = useState([])
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')

  async function load() {
    const response = await fetch('/api/admin/roles', { cache:'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao carregar funções.')
    setRoles(data.roles || [])
  }

  useEffect(() => { load() }, [])

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

  async function saveRole() {
    setMessage('')
    const response = await fetch('/api/admin/roles', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        id: editing,
        name,
        description,
        accesses,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao salvar função.')

    resetForm()
    setMessage('Função salva no Neon.')
    await load()
  }

  function startEdit(role) {
    setEditing(role.id)
    setName(role.name)
    setDescription(role.description || '')
    setAccesses(role.accesses || [])
  }

  async function removeRole(id) {
    if (!window.confirm('Excluir esta função?')) return
    const response = await fetch('/api/admin/roles', {
      method: 'DELETE',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao excluir função.')
    resetForm()
    await load()
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS • NEON</span>
          <h1>FUNÇÕES E PERMISSÕES</h1>
          <p>As funções e permissões agora são compartilhadas entre todos os dispositivos.</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master/cadastros')}>← VOLTAR</button>
      </header>

      <section className="cms-form-card">
        <div className="role-form-grid">
          <label><span>Nome da função</span><input value={name} onChange={e => setName(e.target.value.slice(0,60))} /></label>
          <label><span>Descrição</span><input value={description} onChange={e => setDescription(e.target.value.slice(0,120))} /></label>
        </div>

        <div className="access-box">
          <strong>Telas permitidas</strong>
          <div className="access-grid">
            {ACCESS_OPTIONS.map(([id,label]) => (
              <label className="access-check" key={id}>
                <input type="checkbox" checked={accesses.includes(id)} onChange={() => toggle(id)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="role-form-actions">
          <button className="cms-primary-button" onClick={saveRole}>
            {editing ? 'SALVAR FUNÇÃO' : 'CADASTRAR FUNÇÃO'}
          </button>
          {editing && <button className="cms-neutral-button" onClick={resetForm}>CANCELAR</button>}
        </div>

        {message && <div className="cms-success">{message}</div>}

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
                  {role.id !== 'admin' && <button className="client-delete-button" onClick={() => removeRole(role.id)}>EXCLUIR</button>}
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
