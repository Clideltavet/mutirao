'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hashPassword } from '../../../../components/authUtils'
import { ACCESS_OPTIONS, readRoles } from '../../../../components/roleUtils'

export default function Page() {
  const router = useRouter()
  const [employees,setEmployees] = useState([])
  const [name,setName] = useState('')
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')
  const [accesses,setAccesses] = useState(['ENTRADA','PACIENTES','SAIDA'])
  const [roles,setRoles] = useState([])
  const [roleId,setRoleId] = useState('')
  const [message,setMessage] = useState('')

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem('deltaVetEmployees') || '[]')
      if (Array.isArray(v)) setEmployees(v)
    } catch {}

    const currentRoles = readRoles()
    setRoles(currentRoles)
  }, [])

  function save(next) { setEmployees(next); localStorage.setItem('deltaVetEmployees', JSON.stringify(next)) }
  function toggle(a) { setAccesses(x => x.includes(a) ? x.filter(i => i !== a) : [...x,a]) }

  function changeRole(id) {
    setRoleId(id)
    const role = roles.find(item => item.id === id)
    if (role) setAccesses(role.accesses || [])
  }

  async function add() {
    const n = name.trim(), u = username.trim().toLowerCase()
    if (!n || !u || password.length < 4) return setMessage('Preencha nome, usuário e senha com pelo menos 4 caracteres.')
    if (employees.some(e => e.username?.toLowerCase() === u)) return setMessage('Esse usuário já existe.')
    save([...employees, { id: Date.now(), name:n, username:u, passwordHash: await hashPassword(password), roleId, accesses, active:true }])
    setName(''); setUsername(''); setPassword(''); setRoleId(''); setAccesses(['ENTRADA','PACIENTES','SAIDA']); setMessage('Funcionário cadastrado.')
  }

  async function reset(id) {
    const p = window.prompt('Nova senha (mínimo 4 caracteres):')
    if (!p || p.length < 4) return
    const hash = await hashPassword(p)
    save(employees.map(e => e.id === id ? {...e, passwordHash:hash} : e))
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div><span className="cms-kicker">CADASTROS</span><h1>FUNCIONÁRIOS / ACESSOS</h1><p>Usuário, senha e múltiplas permissões.</p></div>
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
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          <small>Ao escolher uma função, as permissões abaixo são preenchidas automaticamente.</small>
        </label>

        <div className="access-box">
          <strong>Acessos permitidos</strong>
          <div className="access-grid">
            {ACCESS_OPTIONS.map(([id,label]) => <label className="access-check" key={id}><input type="checkbox" checked={accesses.includes(id)} onChange={() => toggle(id)} /><span>{label}</span></label>)}
          </div>
        </div>

        <button className="cms-primary-button" onClick={add}>CADASTRAR FUNCIONÁRIO</button>
        {message && <div className="cms-success">{message}</div>}

        <div className="cms-list">
          {employees.map(e => (
            <div className="cms-list-item employee-item" key={e.id}>
              <div>
                  <strong>{e.name}</strong>
                  <small>@{e.username}</small>
                  <span>Função: {roles.find(role => role.id === e.roleId)?.name || 'Personalizada'}</span>
                  <span>{e.accesses?.join(' • ')}</span>
                </div>
              <div className="employee-actions">
                <button className="password-reset" onClick={() => reset(e.id)}>SENHA</button>
                <button className={e.active ? 'active-user':'inactive-user'} onClick={() => save(employees.map(x => x.id===e.id ? {...x,active:!x.active}:x))}>{e.active ? 'ATIVO':'INATIVO'}</button>
                <button onClick={() => save(employees.filter(x => x.id !== e.id))}>EXCLUIR</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
