import './globals.css'
import AppAccessGate from '../components/AppAccessGate'
import SharedDataSync from '../components/SharedDataSync'

export const metadata = {
  title: 'Controle Delta Vet',
  description: 'Controle de pacientes Delta Vet',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body><SharedDataSync /><AppAccessGate>{children}</AppAccessGate></body>
    </html>
  )
}
