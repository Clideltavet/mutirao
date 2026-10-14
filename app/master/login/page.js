'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginApi, meApi, setAdminSession } from '../../../components/authUtils'

export default function MasterLogin() {
  const router = useRouter()
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')

  useEffect(() => {
    meApi().then(user => {
      if (user?.accesses?.includes('MASTER')) {
        setAdminSession(user)
        router.replace('/master')
      }
    })
  }, [router])

  async function login() {
    setError('')
    try {
      const user = await loginApi(username, password, 'MASTER')
      setAdminSession(user)
      router.replace('/master')
    } catch (error) {
      setError(error.message || 'Usuário ou senha do administrador inválidos.')
    }
  }

  return (
    <main className="vetcore-login-screen">
      <section className="vetcore-login-shell">
        <div className="vetcore-login-brand">
          <div className="vetcore-brand-logo-wrap">
            <img src="/delta-vet-logo.jpg" alt="Delta Vet" className="vetcore-brand-logo" />
          </div>

          <div className="vetcore-brand-copy">
            <span className="vetcore-login-kicker">CONTROLE DELTA VET</span>
            <h1>Painel administrativo e relatórios.</h1>
            <p>
              Gerencie usuários, cadastros, permissões, relatórios e configurações.
            </p>
          </div>

          <div className="vetcore-brand-status">
            <span className="vetcore-status-dot" />
            Acesso administrativo protegido
          </div>
        </div>

        <div className="vetcore-login-panel">
          <div className="vetcore-login-panel-head">
            <span className="vetcore-login-kicker">PAINEL CMS</span>
            <h2>Acesso administrativo</h2>
            <p>Entre com a credencial de administrador.</p>
          </div>

          <label className="vetcore-login-field">
            <span>Usuário</span>
            <div className="vetcore-login-input-wrap">
              <span className="vetcore-input-icon">👤</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g,'').toLowerCase())}
                autoComplete="username"
                placeholder="Usuário admin"
              />
            </div>
          </label>

          <label className="vetcore-login-field">
            <span>Senha</span>
            <div className="vetcore-login-input-wrap">
              <span className="vetcore-input-icon">🔒</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value.slice(0,64))}
                onKeyDown={e => e.key === 'Enter' && login()}
                autoComplete="current-password"
                placeholder="Digite sua senha"
              />
            </div>
          </label>

          {error && <div className="vetcore-login-error">{error}</div>}

          <button className="vetcore-login-button vetcore-admin-login-button" onClick={login}>
            ENTRAR NO PAINEL
          </button>

          <button
            className="vetcore-cms-button"
            type="button"
            onClick={() => router.push('/')}
          >
            ← VOLTAR AO TABLET
          </button>

          <div className="vetcore-login-footer">
            <small>Acesso restrito ao administrador.</small>
            <span>Delta Vet • Painel CMS</span>
          </div>
        </div>
      </section>
    </main>
  )
}
