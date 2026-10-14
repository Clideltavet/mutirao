'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearAdminSession } from '../../components/authUtils'

function readPatients() {
  try {
    const v = JSON.parse(localStorage.getItem('deltaVetPatients') || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function localDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function MasterPage() {
  const router = useRouter()
  const [patients, setPatients] = useState([])

  useEffect(() => {
    const refresh = () => setPatients(readPatients())
    refresh()
    const timer = setInterval(refresh, 1500)
    const onStorage = e => e.key === 'deltaVetPatients' && refresh()
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const today = localDateKey()
  const todayPatients = useMemo(
    () => patients.filter(p => localDateKey(p.createdAt) === today),
    [patients, today]
  )

  const stats = {
    total: todayPatients.length,
    surgery: todayPatients.filter(p => p.status === 'CONFIRMADO').length,
    discharge: todayPatients.filter(p => p.dischargeStatus === 'ALTA').length,
    delivered: todayPatients.filter(p => p.dischargeStatus === 'ENTREGUE').length,
  }

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <main className="cms-screen cms-dashboard-page">
      <section className="cms-dashboard-hero">
        <div className="cms-dashboard-hero-copy">
          <span className="cms-dashboard-kicker">CONTROLE DELTA VET</span>
          <h1>PAINEL CMS</h1>
          <p>
            Relatórios, cadastros e configurações do sistema em um painel central,
            com visual mais profissional para a gestão do fluxo cirúrgico.
          </p>

          <div className="cms-dashboard-meta">
            <div className="cms-dashboard-meta-pill">
              <small>PAINEL</small>
              <strong>Administrador</strong>
            </div>
            <div className="cms-dashboard-meta-pill">
              <small>HOJE</small>
              <strong>{todayLabel}</strong>
            </div>
          </div>
        </div>

        <div className="cms-dashboard-hero-actions">
          <button
            className="cms-dashboard-system-button"
            onClick={() => router.push('/')}
          >
            ← VOLTAR AO SISTEMA
          </button>

          <button
            className="cms-dashboard-logout-button"
            onClick={() => {
              clearAdminSession()
              router.replace('/master/login')
            }}
          >
            SAIR
          </button>
        </div>
      </section>

      <section className="cms-dashboard-stats">
        <div className="cms-dashboard-stat-card">
          <div className="cms-dashboard-stat-icon">🐾</div>
          <div>
            <span>PACIENTES HOJE</span>
            <strong>{stats.total}</strong>
            <small>Total de entradas registradas no dia.</small>
          </div>
        </div>

        <div className="cms-dashboard-stat-card">
          <div className="cms-dashboard-stat-icon">✓</div>
          <div>
            <span>CIRURGIAS CONFIRMADAS</span>
            <strong>{stats.surgery}</strong>
            <small>Pacientes com procedimento confirmado.</small>
          </div>
        </div>

        <div className="cms-dashboard-stat-card">
          <div className="cms-dashboard-stat-icon">↑</div>
          <div>
            <span>DE ALTA</span>
            <strong>{stats.discharge}</strong>
            <small>Prontos para seguir para a saída.</small>
          </div>
        </div>

        <div className="cms-dashboard-stat-card">
          <div className="cms-dashboard-stat-icon">✓</div>
          <div>
            <span>ENTREGUES</span>
            <strong>{stats.delivered}</strong>
            <small>Pacientes finalizados no fluxo de hoje.</small>
          </div>
        </div>
      </section>

      <section className="cms-dashboard-section-head">
        <div>
          <h2>Módulos principais</h2>
          <p>Escolha um módulo para administrar o sistema.</p>
        </div>
      </section>

      <section className="cms-dashboard-modules">
        <button className="cms-dashboard-module-card" onClick={() => router.push('/master/relatorios')}>
          <div className="cms-dashboard-module-top">
            <span className="cms-dashboard-module-icon">▥</span>
            <span className="cms-dashboard-module-tag">ANÁLISE</span>
          </div>
          <strong>RELATÓRIOS</strong>
          <p>
            Consulte totais, animais, tutores, espécies, procedimentos,
            veterinários, períodos e exportações em CSV.
          </p>
          <div className="cms-dashboard-module-footer">Abrir módulo →</div>
        </button>

        <button className="cms-dashboard-module-card" onClick={() => router.push('/master/cadastros')}>
          <div className="cms-dashboard-module-top">
            <span className="cms-dashboard-module-icon">＋</span>
            <span className="cms-dashboard-module-tag">ESTRUTURA</span>
          </div>
          <strong>CADASTROS</strong>
          <p>
            Gerencie veterinários, procedimentos, adicionais cirúrgicos,
            funcionários e acessos do sistema.
          </p>
          <div className="cms-dashboard-module-footer">Abrir módulo →</div>
        </button>

        <button className="cms-dashboard-module-card" onClick={() => router.push('/master/configuracoes')}>
          <div className="cms-dashboard-module-top">
            <span className="cms-dashboard-module-icon">⚙</span>
            <span className="cms-dashboard-module-tag">SISTEMA</span>
          </div>
          <strong>CONFIGURAÇÕES</strong>
          <p>
            Ajuste numeração de fichas, segurança do administrador e preferências
            gerais do Controle Delta Vet.
          </p>
          <div className="cms-dashboard-module-footer">Abrir módulo →</div>
        </button>
      </section>
    </main>
  )
}
