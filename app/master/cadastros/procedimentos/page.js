'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  currencyBRL,
  moneyMask,
  moneyToNumber,
  readProcedureCatalog,
  saveProcedureCatalog,
} from '../../../../components/procedureUtils'

export default function ProceduresPage() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    const catalog = readProcedureCatalog()
    setItems(catalog)
    saveProcedureCatalog(catalog)
  }, [])

  function persist(next) {
    const saved = saveProcedureCatalog(next)
    setItems(saved)
  }

  function add() {
    const cleanName = name.trim()
    if (!cleanName || items.some(item => item.name.toLowerCase() === cleanName.toLowerCase())) return

    persist([
      ...items,
      {
        id: `proc-${Date.now()}`,
        name: cleanName,
        value: moneyToNumber(value),
      }
    ])

    setName('')
    setValue('')
  }

  function startEdit(item) {
    setEditing(item.id)
    setEditName(item.name)
    setEditValue(moneyMask(String(Math.round((Number(item.value) || 0) * 100))))
  }

  function saveEdit(item) {
    const cleanName = editName.trim()
    if (!cleanName) return

    persist(items.map(current =>
      current.id === item.id
        ? { ...current, name: cleanName, value: moneyToNumber(editValue) }
        : current
    ))
    setEditing(null)
  }

  function remove(id) {
    persist(items.filter(item => item.id !== id))
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS</span>
          <h1>CIRURGIAS / PROCEDIMENTOS</h1>
          <p>Cadastre os serviços e seus valores. Os valores aparecem somente no CMS e nos relatórios.</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master/cadastros')}>← VOLTAR</button>
      </header>

      <section className="cms-form-card">
        <div className="procedure-value-add-grid">
          <label>
            <span>Procedimento</span>
            <input
              value={name}
              onChange={e => setName(e.target.value.slice(0,80))}
              placeholder="Ex.: Castração canina"
            />
          </label>

          <label>
            <span>Valor</span>
            <div className="money-input-wrap">
              <span>R$</span>
              <input
                value={value}
                inputMode="numeric"
                onChange={e => setValue(moneyMask(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </label>

          <button className="cms-primary-button" onClick={add}>ADICIONAR</button>
        </div>

        <div className="procedure-value-note">
          Os valores são administrativos e não aparecem no tablet, na TV ou no painel da recepção.
        </div>

        <div className="procedure-value-list">
          {items.map(item => (
            <div className="procedure-value-row" key={item.id}>
              {editing === item.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value.slice(0,80))} />
                  <div className="money-input-wrap">
                    <span>R$</span>
                    <input
                      value={editValue}
                      inputMode="numeric"
                      onChange={e => setEditValue(moneyMask(e.target.value))}
                    />
                  </div>
                  <button className="client-edit-button" onClick={() => saveEdit(item)}>SALVAR</button>
                  <button className="client-delete-button" onClick={() => setEditing(null)}>CANCELAR</button>
                </>
              ) : (
                <>
                  <strong>{item.name}</strong>
                  <span className="procedure-admin-value">{currencyBRL(item.value)}</span>
                  <button className="client-edit-button" onClick={() => startEdit(item)}>EDITAR</button>
                  <button className="client-delete-button" onClick={() => remove(item.id)}>EXCLUIR</button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
