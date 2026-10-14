'use client'

import { useRouter } from 'next/navigation'

export default function CadastrosPage() {
  const router = useRouter()
  const modules = [
    ['Funções e Permissões','Crie funções prontas como Recepção, Estagiário e Pós-operatório.','/master/cadastros/funcoes'],
    ['Clientes / Tutores','Cadastro central de clientes com telefone, CPF, e-mail e histórico de animais.','/master/cadastros/clientes'],
    ['Veterinários','Cadastre quem pode aparecer nas confirmações e altas.','/master/cadastros/veterinarios'],
    ['Cirurgias / Procedimentos','Cadastre serviços e valores administrativos usados nos relatórios.','/master/cadastros/procedimentos'],
    ['Adicionais cirúrgicos','Cio, piometra, prenhez e outros itens configuráveis.','/master/cadastros/adicionais'],
    ['Funcionários / Acessos','Pré-cadastro de funcionários e múltiplos acessos.','/master/cadastros/funcionarios'],
  ]

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">PAINEL CMS</span>
          <h1>CADASTROS</h1>
          <p>Cadastros usados nas telas do Controle Delta Vet</p>
        </div>
        <button className="cms-exit-button" onClick={() => router.push('/master')}>← VOLTAR</button>
      </header>

      <section className="cms-grid">
        {modules.map(([title,desc,path]) => (
          <button className="cms-module" key={title} onClick={() => router.push(path)}>
            <strong>{title.toUpperCase()}</strong>
            <small>{desc}</small>
          </button>
        ))}
      </section>
    </main>
  )
}
