'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()
  const [nextNumber,setNextNumber] = useState('1')
  const [msg,setMsg] = useState('')

  useEffect(() => {
    setNextNumber(localStorage.getItem('deltaVetNextPatientNumber') || '1')
  }, [])

  function saveNumber() {
    const n = Math.max(1, Number(nextNumber)||1)
    localStorage.setItem('deltaVetNextPatientNumber', String(n))
    setNextNumber(String(n))
    setMsg('Numeração salva nesta etapa.')
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">PAINEL CMS</span>
          <h1>CONFIGURAÇÕES</h1>
          <p>Login, usuários e senhas já estão no Neon. Os demais dados serão migrados na próxima etapa.</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master')}>← VOLTAR</button>
      </header>

      <section className="cms-form-card cms-settings-stack">
        <div className="cms-settings-section">
          <h2>Numeração das fichas</h2>
          <label className="cms-setting-field">
            <span>Próxima ficha</span>
            <input
              type="number"
              inputMode="numeric"
              value={nextNumber}
              onChange={e => setNextNumber(e.target.value.replace(/\D/g,'').slice(0,8))}
            />
          </label>
          <button className="cms-primary-button" onClick={saveNumber}>SALVAR NUMERAÇÃO</button>
        </div>

        <div className="cms-info-note">
          Para alterar a senha de um funcionário ou do administrador, use
          <strong> Cadastros → Funcionários / Acessos → SENHA</strong>.
          A nova senha é gravada no Neon em formato protegido (hash), nunca em texto puro.
        </div>

        {msg && <div className="cms-success">{msg}</div>}
      </section>
    </main>
  )
}
