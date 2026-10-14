'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearTabletSession, getTabletSession, loginApi, logoutApi, meApi, setTabletSession } from '../components/authUtils'

function readJSON(key, fallback=[]) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback } catch { return fallback }
}
function dayKey(v=new Date()) {
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Home() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [patients, setPatients] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const localSession = getTabletSession()
    setSession(localSession)

    meApi().then(currentSession => {
      if (!currentSession) {
        clearTabletSession()
        setSession(null)
        return
      }

      setTabletSession(currentSession)
      setSession(currentSession)

      if (
        currentSession?.accesses?.length === 1 &&
        currentSession.accesses.includes('RECEPCAO')
      ) {
        router.replace('/recepcao')
      }
    })
    const refresh = () => setPatients(readJSON('deltaVetPatients', []))
    refresh()
    const timer = setInterval(refresh, 1000)
    return () => clearInterval(timer)
  }, [])

  const canLeave = useMemo(() => {
    const today = dayKey()
    return patients.filter(p => dayKey(p.createdAt) === today && p.dischargeStatus === 'ALTA').length
  }, [patients])

  async function login() {
    setError('')
    try {
      const user = await loginApi(username, password)
      setTabletSession(user)
      setSession(user)
      setPassword('')

      if (user.accesses?.length === 1 && user.accesses.includes('RECEPCAO')) {
        router.replace('/recepcao')
      }
    } catch (error) {
      setError(error.message || 'Usuário ou senha inválidos.')
    }
  }

  async function logout() { await logoutApi(); clearTabletSession(); setSession(null) }

  if (!session) {
    return (
      <main className="vetcore-login-screen">
        <section className="vetcore-login-shell">
          <div className="vetcore-login-brand">
            <div className="vetcore-brand-logo-wrap">
              <img src="/delta-vet-logo.jpg" alt="Delta Vet" className="vetcore-brand-logo" />
            </div>

            <div className="vetcore-brand-copy">
              <span className="vetcore-login-kicker">CONTROLE DELTA VET</span>
              <h1>Gestão cirúrgica simples, rápida e segura.</h1>
              <p>
                Entrada, pacientes, alta e entrega em um único fluxo operacional.
              </p>
            </div>

            <div className="vetcore-brand-status">
              <span className="vetcore-status-dot" />
              Sistema operacional
            </div>
          </div>

          <div className="vetcore-login-panel">
            <div className="vetcore-login-panel-head">
              <span className="vetcore-login-kicker">ACESSO AO TABLET</span>
              <h2>Entrar no sistema</h2>
              <p>Use seu usuário de funcionário ou estagiário.</p>
            </div>

            <label className="vetcore-login-field">
              <span>Usuário</span>
              <div className="vetcore-login-input-wrap">
                <span className="vetcore-input-icon">👤</span>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g,'').toLowerCase())}
                  maxLength={30}
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="Digite seu usuário"
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

            <button className="vetcore-login-button" onClick={login}>
              ENTRAR
            </button>

            <button
              className="vetcore-cms-button"
              type="button"
              onClick={() => router.push('/master/login')}
            >
              <span>⚙</span>
              PAINEL CMS
            </button>

            <div className="vetcore-login-footer">
              <small>Usuários são cadastrados pelo administrador no Painel CMS.</small>
              <span>Delta Vet • Controle interno</span>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const has = a => session.accesses?.includes(a)

  return (
    <main className="home-screen home-screen-premium">
      <section className="home-card home-card-premium">
        <div className="tablet-userbar tablet-userbar-premium">
          <div className="tablet-user-identification">
            <small>USUÁRIO LOGADO</small>
            <strong>{session.name}</strong>
          </div>

          <div className="tablet-user-side">
            {has('RECEPCAO') && (
              <button className="reception-shortcut-button" onClick={() => router.push('/recepcao')}>
                RECEPÇÃO
              </button>
            )}
            <div className="tablet-mini-status">
              <span className="tablet-mini-dot" />
              SISTEMA ATIVO
            </div>
            <button onClick={logout}>SAIR</button>
          </div>
        </div>

        <div className="brand-wrap brand-wrap-premium">
          <div className="brand-logo-shell">
            <img src="/delta-vet-logo.jpg" alt="Delta Vet" className="brand-logo" />
          </div>

          <span className="brand-kicker">CONTROLE OPERACIONAL</span>
          <h1>CONTROLE DELTA VET</h1>
          <p className="brand-subtitle">
            Entrada, pacientes e saída organizados em um fluxo simples para a equipe.
          </p>

          <div className="home-top-info">
            <div className="home-info-pill">
              <small>LIBERAÇÕES</small>
              <strong>{canLeave}</strong>
            </div>
            <div className="home-info-pill">
              <small>DATA</small>
              <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
            </div>
          </div>
        </div>

        <div className="home-actions home-actions-three">
          {has('ENTRADA') && <Link href="/entrada" className="home-action home-action-entry"><span className="home-icon">↓</span><span>ENTRADA</span></Link>}
          {has('PACIENTES') && <Link href="/pacientes" className="home-action home-action-patients"><span className="home-icon">≡</span><span>PACIENTES</span></Link>}
          {has('SAIDA') && (
            <Link href="/saida" className="home-action home-action-exit home-exit-with-counter">
              <span className="home-icon">↑</span><span>SAÍDA</span>
              <span className={`home-release-counter ${canLeave ? 'has-patients' : ''}`}>
                <strong>{canLeave}</strong><small>{canLeave === 1 ? 'PODE IR EMBORA' : 'PODEM IR EMBORA'}</small>
              </span>
            </Link>
          )}
        </div>

        <div className="home-bottom-tip">
          Toque em uma das opções para continuar o atendimento.
        </div>
      </section>
    </main>
  )
}
