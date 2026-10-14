'use client'

export default function PhoneInput({ value, onChange }) {
  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
  }
  return <input className="field-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="(__) _____-____" value={value} onChange={(e)=>onChange(formatPhone(e.target.value))} />
}
