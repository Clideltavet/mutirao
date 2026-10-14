import './globals.css'
import AppAccessGate from '../components/AppAccessGate'

export const metadata = {
  title: 'Controle Delta Vet',
  description: 'Controle de pacientes Delta Vet',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body><AppAccessGate>{children}</AppAccessGate></body>
    </html>
  )
}
