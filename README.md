# Controle Delta Vet v1.18.1

Correção visual v1.18.1: sincronização automática continua a cada 1,8 segundo,
sem alternar o botão a cada ciclo. “Sincronizando...” aparece na primeira conexão
ou no acionamento manual. Falhas e horário confirmado continuam visíveis.
Arquivos desta correção: components/SharedDataSync.js, components/SyncStatus.js,
package.json, package-lock.json, tests/browser.mjs e README.md.
Não há migração adicional para quem já aplicou a v1.18.0.

Manutenção incremental da v1.17.4. As telas e o histórico existentes foram mantidos.

## Causa do bug

A Entrada salvava somente em localStorage, anunciava sucesso e avançava React para
501. Uma sincronização iniciada antes desse cadastro podia devolver 500 e substituir
tanto o cache quanto a tela. Além disso, o backend fazia SELECT, cálculo e UPDATE da
sequência separadamente; duas requisições podiam gravar resultados concorrentes.
A sincronização também substituía listas locais completas e apagava toda a fila de
exclusões, inclusive itens criados durante a requisição.

## Correção

- `POST /api/patients`: exige acesso ENTRADA e confirma paciente, auditoria e avanço
  da sequência na mesma transação PostgreSQL.
- Todas as gravações de sincronização/configuração/entrada usam `delta_apply`, com
  `pg_advisory_xact_lock(174,501)`. O bloqueio pertence à transação, não à instância
  Next/Vercel. Envios concorrentes são serializados pelo banco.
- O servidor devolve `patient`, `nextPatientNumber`, `sequenceRevision` e
  `sequenceEpoch`. A Entrada usa a resposta imediatamente, sem aguardar o polling.
- Revisões antigas não fazem a sequência retroceder. Reinício deliberado pelo
  administrador continua permitido, com revisão e época novas.
- UUID persistido antes do envio permite repetir uma requisição cuja resposta foi
  perdida sem criar outro paciente ou consumir outra ficha.
- Falha de rede: a solicitação permanece em `deltaVetPendingEntry:<UUID>` no
  localStorage. Reabra Entrada e use RETOMAR ENVIO. Não é emitida ficha definitiva
  offline: isso evita prometer o mesmo número em dois aparelhos desconectados.
- Registros antigos de `deltaVetPatients` continuam sendo importados sem renumeração.
  O contador antigo do navegador não altera o contador oficial do Neon.
- Respostas de sincronização são mescladas com o estado local atual. Inclusões e
  alterações feitas durante a requisição permanecem no aparelho para o próximo envio.
- Exclusões mantêm tombstones permanentes. Relógio adiantado ou aparelho antigo não
  autoriza ressuscitar o mesmo registro. Só exclusões confirmadas são retiradas da fila.
- Revisões de registros alterados, conflitantes ou excluídos ficam preservadas em
  `shared_record_versions` para recuperação técnica; a linha do tempo é mesclada.
  Edições simultâneas do mesmo campo ainda usam a versão temporal vencedora; a versão
  alternativa é arquivada, não existe editor visual de conflitos nesta versão.
- Cirurgia, alta, entrega, reinternação e edição usam identidade estável do paciente,
  não apenas a ficha. Isso protege fichas iguais de mutirões anteriores.
- Edição cadastral preserva alterações clínicas recentes e os preços históricos dos
  procedimentos que permanecem no atendimento.
- A auditoria local não é mais truncada em 10.000 itens.
- TV continua sem login, com gravação restrita a campos cirúrgicos/alta e suas ações
  de auditoria. Importar novas entradas exige sessão; excluir e configurar exige MASTER.
- Relatórios mantidos; busca ampliada para espécie e veterinários.
- Status mostra sincronização em andamento, falha, modo local, horário confirmado e
  pendências que ainda exigem reenvio/permissão.
- Next atualizado de 14.2.31 para 14.2.35, mantendo Next 14/React 18.

## Atualizar uma instalação existente

1. Guarde uma cópia da pasta atual e do `.env.local`. Não limpe o armazenamento dos
   navegadores. Não substitua `.env.local` por `.env.example`.
2. Copie o conteúdo desta versão para a pasta do repositório existente, preservando
   `.git` e `.env.local`. Não copie `node_modules` ou `.next` de outras versões.
3. No PowerShell, execute os comandos abaixo, um por linha. Pare se algum falhar:

```powershell
npm ci
npm run db:migrate
npm test
npm run build
```

4. Publique o código. Após a publicação, recarregue TODOS os aparelhos com Ctrl+F5
   (ou feche e reabra a página no tablet), sem limpar dados do site.
5. Entre em cada dispositivo que guarda dados locais, sincronize e confira o status.
   Para catálogos/exclusões pendentes, entre como administrador nesse dispositivo.
6. Execute o roteiro de aceitação abaixo antes de retomar entradas da cliente.

**Não execute `npm run db:init` nesta atualização.** O inicializador antigo recria/
atualiza papéis e redefine a senha do administrador a partir do ambiente. Ele é
reservado a uma instalação nova, em banco vazio; agora também executa a migração.

Use Node 20.19+ (os testes desta entrega foram executados em Node 24).

## Alteração exata no banco

Execute `npm run db:migrate` uma vez antes do novo deploy. Pode repetir com segurança.
O script aplica `migrations/001_atomic_sync.sql` em uma transação e requer a estrutura
já existente da v1.17.4 (`system_state`, `shared_records`, `shared_tombstones`).

- Cria apenas a tabela adicional `shared_record_versions` com `id`, `kind`,
  `record_key`, `payload` e `saved_at`.
- Cria/substitui as funções `delta_date(text)`, `delta_array(jsonb)`, `delta_key(text,jsonb)` e
  `delta_apply(text,jsonb,jsonb)`.
- Em operação, acrescenta `revision` ao JSON da chave `nextPatientNumber` em
  `system_state`; mantém `value`, `epoch`, `source` e demais metadados.
- Não há DROP, TRUNCATE, limpeza de tabelas, renumeração, alteração de senhas ou
  atualização em massa dos registros existentes na migração.
- Exclusões solicitadas pelo administrador durante o uso removem o registro ativo,
  preservam sua versão arquivada, sua auditoria e a marca permanente de exclusão.
- A migração não foi executada no banco real da cliente nesta entrega.

## Vercel e variáveis

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Obrigatória no servidor, apontando ao mesmo Neon atual, com SSL. Configure nos ambientes Vercel correspondentes. |
| `ADMIN_USER` | Somente inicialização de instalação nova; padrão `admin`. |
| `ADMIN_PASSWORD` | Somente `db:init` de instalação nova; não é necessária para `db:migrate` nem para o login normal. |
| `ADMIN_NAME` | Somente inicialização de instalação nova. |

Não use prefixo `NEXT_PUBLIC_` para credenciais. Nenhuma variável nova é exigida.
Não rode `db:init` como etapa de build da Vercel. Build: `npm run build`.
Instalação: `npm ci`. Framework: Next.js. Migração: execute manualmente com o
`DATABASE_URL` correto antes de publicar, fora do build.

## Comandos Git (PowerShell)

Execute na pasta do repositório já conectado ao GitHub:

```powershell
git status
git add app components lib scripts migrations tests package.json package-lock.json README.md ALTERACOES-v1.18.0.md
git diff --cached --stat
git commit -m "fix: numeracao atomica e sincronizacao segura Delta Vet v1.18.0"
git push
```

Confira os arquivos no `git status` antes do commit. Não envie `.env.local` ou a
pasta `.git` de outro projeto. Os comandos usam o branch/remoto atual, sem presumir
que ele se chama `main`. Esta entrega não fez push nem deploy.

## Teste obrigatório em homologação

Use uma cópia/branch de homologação do Neon para não introduzir pacientes de teste
no atendimento real. O reinício deliberado da ficha não altera pacientes antigos.

1. Administrador: Configurações → próxima ficha **500** → salvar no Neon.
2. Entrada: deve mostrar **500**. Cadastre um paciente e envie.
3. Ao receber sucesso do servidor, deve mostrar **501** imediatamente.
4. Cadastre outro: deve mostrar **502** imediatamente.
5. Atualize a página: deve continuar **502**.
6. Abra outro aparelho, faça login e espere a confirmação da sincronização: **502**.
7. Envie um paciente em cada aparelho ao mesmo tempo: o backend atribui **502** e
   **503**, um por paciente, e ambos convergem para próxima ficha **504**.
   O número exibido antes do envio é uma previsão, não uma reserva.
8. Atrase a rede: uma resposta antiga não pode fazer o número voltar.
9. Interrompa a conexão durante um envio e retome. Deve existir somente um paciente
   para aquela solicitação, mesmo se o servidor já tivesse confirmado o primeiro envio.
10. Exclua um teste pelo CMS com as duas confirmações. Reabra outro dispositivo com
    cache antigo: o registro excluído não pode reaparecer após a sincronização.
11. Faça cirurgia, alta, entrega e reinternação; confira auditoria/cores e verifique
    que outra ficha igual de mutirão anterior permaneceu intacta.

Todos os dispositivos de entrada precisam carregar esta versão. Uma aba v1.17.4
que continue criando registros localmente ainda produz fichas sem confirmação;
registros legados já duplicados são preservados, não corrigidos por renumeração.

## Verificações incluídas

- `npm test`: 11 testes passando sobre o SQL real em PGlite, um PostgreSQL isolado
  embarcado; sequência, repetição idempotente, reset, exclusão persistente, importação,
  mesclagem, histórico de preços, repetição de migração e rollback de transação.
- `npm run build`: build de produção Next.js.
- `tests/browser.mjs`: navegador Chromium com a interface real e o mesmo SQL em
  PGlite. Passou 500→501→502, resposta atrasada, reload, segunda sessão, envio
  simultâneo de duas sessões e perda de resposta seguida de retomada sem duplicação.
- HTTP e autenticação foram interceptados nesse teste de navegador. PGlite serializa
  as consultas em uma conexão: ele não substitui a validação de contenção em múltiplas
  conexões Neon nem a autenticação real de produção.
- Não foram acessados Neon, Vercel ou GitHub reais. Faça o teste de homologação acima
  após configurar o ambiente. Não há garantia baseada em um teste em produção.

Para repetir o teste de navegador, em um terminal rode `npm run dev`. Em outro:

```powershell
npx playwright install chromium
npm run test:browser
```

O teste usa `http://localhost:3000`, dados sintéticos e intercepta as APIs; não altera
seu Neon. A relação exata de arquivos alterados/adicionados está em
`ALTERACOES-v1.18.0.md`.
