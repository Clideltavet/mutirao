'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hashPassword } from '../../../components/authUtils'

export default function Page() {
  const router = useRouter()
  const [nextNumber,setNextNumber] = useState('1')
  const [adminUser,setAdminUser] = useState('admin')
  const [pass,setPass] = useState('')
  const [confirm,setConfirm] = useState('')
  const [msg,setMsg] = useState('')

  useEffect(() => {
    setNextNumber(localStorage.getItem('deltaVetNextPatientNumber') || '1')
    try { const c = JSON.parse(localStorage.getItem('deltaVetAdminCredentials') || 'null'); if (c?.username) setAdminUser(c.username) } catch {}
  }, [])

  function saveNumber() {
    const n = Math.max(1, Number(nextNumber)||1)
    localStorage.setItem('deltaVetNextPatientNumber', String(n))
    setNextNumber(String(n)); setMsg('Numeração salva.')
  }

  async function saveAdmin() {
    if (!adminUser.trim() || pass.length < 6) return setMsg('Senha do admin precisa ter pelo menos 6 caracteres.')
    if (pass !== confirm) return setMsg('As senhas não conferem.')
    localStorage.setItem('deltaVetAdminCredentials', JSON.stringify({ username:adminUser.trim().toLowerCase(), passwordHash:await hashPassword(pass) }))
    setPass(''); setConfirm(''); setMsg('Acesso admin atualizado.')
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div><span className="cms-kicker">PAINEL CMS</span><h1>CONFIGURAÇÕES</h1><p>Numeração e segurança.</p></div>
        <button className="cms-exit-button" onClick={() => router.push('/master')}>← VOLTAR</button>
      </header>

      <section className="cms-form-card cms-settings-stack">
        <div className="cms-settings-section">
          <h2>Numeração das fichas</h2>
          <label className="cms-setting-field"><span>Próxima ficha</span><input type="number" inputMode="numeric" value={nextNumber} onChange={e => setNextNumber(e.target.value.replace(/\D/g,'').slice(0,8))} /></label>
          <button className="cms-primary-button" onClick={saveNumber}>SALVAR NUMERAÇÃO</button>
        </div>

        <div className="cms-settings-section">
          <h2>Acesso do administrador</h2>
          <div className="employee-form-grid">
            <label><span>Usuário</span><input value={adminUser} onChange={e => setAdminUser(e.target.value.replace(/[^a-zA-Z0-9._-]/g,'').toLowerCase())} /></label>
            <label><span>Nova senha</span><input type="password" value={pass} onChange={e => setPass(e.target.value.slice(0,64))} /></label>
            <label><span>Confirmar senha</span><input type="password" value={confirm} onChange={e => setConfirm(e.target.value.slice(0,64))} /></label>
          </div>
          <button className="cms-primary-button" onClick={saveAdmin}>ALTERAR ACESSO ADMIN</button>
        </div>

        {msg && <div className="cms-success">{msg}</div>}
      </section>
    </main>
  )
}
