'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ACCESS_OPTIONS } from '../../../../components/roleUtils'

export default function Page() {
  const router = useRouter()
  const [employees,setEmployees] = useState([])
  const [roles,setRoles] = useState([])
  const [name,setName] = useState('')
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')
  const [roleId,setRoleId] = useState('')
  const [accesses,setAccesses] = useState([])
  const [message,setMessage] = useState('')
  const [loading,setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/roles', { cache: 'no-store' }),
      ])
      const usersData = await usersRes.json()
      const rolesData = await rolesRes.json()
      if (!usersRes.ok) throw new Error(usersData.error || 'Erro ao carregar usuários.')
      if (!rolesRes.ok) throw new Error(rolesData.error || 'Erro ao carregar funções.')
      setEmployees(usersData.users || [])
      setRoles(rolesData.roles || [])
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggle(access) {
    setAccesses(current =>
      current.includes(access)
        ? current.filter(item => item !== access)
        : [...current, access]
    )
  }

  function changeRole(id) {
    setRoleId(id)
    const role = roles.find(item => item.id === id)
    setAccesses(role?.accesses || [])
  }

  async function add() {
    setMessage('')
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ name, username, password, roleId: roleId || null, accesses }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao cadastrar.')

    setName('')
    setUsername('')
    setPassword('')
    setRoleId('')
    setAccesses([])
    setMessage('Funcionário cadastrado no Neon.')
    await load()
  }

  async function resetPassword(id) {
    const newPassword = window.prompt('Nova senha (mínimo 4 caracteres):')
    if (!newPassword) return

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id, newPassword }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao alterar senha.')
    setMessage('Senha atualizada. As sessões desse usuário foram encerradas.')
  }

  async function toggleActive(employee) {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id: employee.id, active: !employee.active }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao alterar usuário.')
    await load()
  }

  async function remove(id) {
    if (!window.confirm('Excluir este usuário?')) return
    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage(data.error || 'Erro ao excluir usuário.')
    await load()
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS • NEON</span>
          <h1>FUNCIONÁRIOS / ACESSOS</h1>
          <p>Usuários e senhas agora ficam gravados no banco Neon.</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master/cadastros')}>← VOLTAR</button>
      </header>

      <section className="cms-form-card">
        <div className="employee-form-grid employee-form-grid-three">
          <label><span>Nome</span><input value={name} onChange={e => setName(e.target.value.slice(0,80))} /></label>
          <label><span>Usuário</span><input value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g,'').toLowerCase())} /></label>
          <label><span>Senha</span><input type="password" value={password} onChange={e => setPassword(e.target.value.slice(0,64))} /></label>
        </div>

        <label className="employee-role-select">
          <span>Função</span>
          <select value={roleId} onChange={e => changeRole(e.target.value)}>
            <option value="">Selecione uma função...</option>
            {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <small>A função aplica as permissões abaixo automaticamente.</small>
        </label>

        <div className="access-box">
          <strong>Acessos permitidos</strong>
          <div className="access-grid">
            {ACCESS_OPTIONS.map(([id,label]) => (
              <label className="access-check" key={id}>
                <input type="checkbox" checked={accesses.includes(id)} onChange={() => toggle(id)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="cms-primary-button" onClick={add}>CADASTRAR FUNCIONÁRIO</button>
        {message && <div className="cms-success">{message}</div>}

        <div className="cms-list">
          {loading ? (
            <div className="cms-empty">Carregando usuários do Neon...</div>
          ) : employees.length ? employees.map(e => (
            <div className="cms-list-item employee-item" key={e.id}>
              <div>
                <strong>{e.name}</strong>
                <small>@{e.username}</small>
                <span>Função: {e.roleName || 'Personalizada'}</span>
                <span>{e.accesses?.join(' • ') || 'Sem acesso'}</span>
              </div>
              <div className="employee-actions">
                <button className="password-reset" onClick={() => resetPassword(e.id)}>SENHA</button>
                <button className={e.active ? 'active-user':'inactive-user'} onClick={() => toggleActive(e)}>{e.active ? 'ATIVO':'INATIVO'}</button>
                <button onClick={() => remove(e.id)}>EXCLUIR</button>
              </div>
            </div>
          )) : (
            <div className="cms-empty">Nenhum usuário cadastrado.</div>
          )}
        </div>
      </section>
    </main>
  )
}
