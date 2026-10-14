'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULTS = []

export default function Page() {
  const router = useRouter()
  const [items, setItems] = useState(DEFAULTS)
  const [value, setValue] = useState('')

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('deltaVetVeterinarians') || 'null')
      if (Array.isArray(stored)) setItems(stored)
    } catch {}
  }, [])

  function save(next) {
    setItems(next)
    localStorage.setItem('deltaVetVeterinarians', JSON.stringify(next))
  }

  function add() {
    const v = value.trim()
    if (!v || items.some(item => item.toLowerCase() === v.toLowerCase())) return
    save([...items, v])
    setValue('')
  }

  function remove(item) {
    save(items.filter(x => x !== item))
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS</span>
          <h1>VETERINÁRIOS</h1>
          <p>Lista usada na cirurgia e na liberação de alta.</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master/cadastros')}>← VOLTAR</button>
      </header>

      <section className="cms-form-card">
        <div className="cms-add-row">
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Ex.: Dra. Bruna"
          />
          <button onClick={add}>ADICIONAR</button>
        </div>

        <div className="cms-list">
          {items.length ? items.map(item => (
            <div className="cms-list-item" key={item}>
              <span>{item}</span>
              <button onClick={() => remove(item)}>EXCLUIR</button>
            </div>
          )) : <div className="cms-empty">Nenhum cadastro.</div>}
        </div>
      </section>
    </main>
  )
}
