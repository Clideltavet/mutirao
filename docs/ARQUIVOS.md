# Inventário e relatório de arquivos

62 arquivos originais inventariados. CSS e logotipo preservados. A cópia original do ZIP não foi alterada.

| Arquivo | Estado | Revisão / motivo |
|---|---|---|
| `.gitignore` | inalterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `ALTERACOES-v1.18.0.md` | inalterado | Documentação histórica mantida ou atualizada; novos relatórios são referência da entrega. |
| `README.md` | alterado | Documentação histórica mantida ou atualizada; novos relatórios são referência da entrega. |
| `app/api/admin/roles/route.js` | alterado | Revisão obrigatória, autorização e operações transacionais; sequência serializada. |
| `app/api/admin/settings/sequence/route.js` | alterado | Revisão obrigatória, autorização e operações transacionais; sequência serializada. |
| `app/api/admin/users/route.js` | alterado | Revisão obrigatória, autorização e operações transacionais; sequência serializada. |
| `app/api/auth/login/route.js` | alterado | Sessões preservadas; cookies assíncronos; limite de tentativas; nenhuma troca automática de senha. |
| `app/api/auth/logout/route.js` | alterado | Sessões preservadas; cookies assíncronos; limite de tentativas; nenhuma troca automática de senha. |
| `app/api/auth/me/route.js` | alterado | Sessões preservadas; cookies assíncronos; limite de tentativas; nenhuma troca automática de senha. |
| `app/api/patients/entry/route.js` | alterado | Caminhos de cadastro unificados em comando atômico e idempotente. |
| `app/api/patients/route.js` | alterado | Caminhos de cadastro unificados em comando atômico e idempotente. |
| `app/api/sync/shared/route.js` | alterado | Sincronização pública por snapshots substituída por leitura autenticada; POST legado recusado. |
| `app/cirurgia/page.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `app/configuracoes/page.js` | alterado | Sequência/configurações no banco com revisão; autorização inicial da TV. |
| `app/entrada/page.js` | alterado | Rascunho persistente, ID estável, confirmação de commit e reenvio seguro. |
| `app/globals.css` | inalterado | 3866 linhas de estilo preservadas byte a byte; não contém imports/URLs externos. |
| `app/layout.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `app/master/cadastros/adicionais/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/cadastros/clientes/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/cadastros/funcionarios/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/cadastros/funcoes/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/cadastros/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/cadastros/procedimentos/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/cadastros/veterinarios/page.js` | alterado | Cadastros/configurações com confirmação no servidor; permissões e revisão. |
| `app/master/configuracoes/page.js` | alterado | Sequência/configurações no banco com revisão; autorização inicial da TV. |
| `app/master/layout.js` | alterado | Gate por permissão e carga confirmada antes de exibir dados; cache isolado por aba. |
| `app/master/login/page.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `app/master/page.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `app/master/relatorios/page.js` | alterado | Somente cache confirmado, valores históricos, exclusão lógica confirmada e CSV protegido. |
| `app/pacientes/[id]/editar/page.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `app/pacientes/[id]/page.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `app/pacientes/page.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `app/page.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `app/recepcao/page.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `app/saida/page.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `components/AppAccessGate.js` | alterado | Gate por permissão e carga confirmada antes de exibir dados; cache isolado por aba. |
| `components/ClientModal.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `components/DischargeModal.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `components/PatientRecordModal.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `components/PhoneInput.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `components/SharedDataSync.js` | alterado | Leitura apenas; nunca envia localStorage ou limpa fila antiga. |
| `components/SurgeryConfirmModal.js` | alterado | Identidade única e revisão do registro; transição confirmada antes de fechar modal. |
| `components/SyncStatus.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `components/auditUtils.js` | alterado | Auditoria nova produzida no servidor junto à operação; histórico antigo preservado. |
| `components/authUtils.js` | alterado | Gate por permissão e carga confirmada antes de exibir dados; cache isolado por aba. |
| `components/clientUtils.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `components/procedureUtils.js` | alterado | Não reprecifica histórico pelo catálogo atual; soma monetária em centavos. |
| `components/roleUtils.js` | alterado | Leitura de cache/fluxo revisado; componentes e rotas existentes mantidos. |
| `components/sequenceState.js` | alterado | Chaves legadas preservadas, escrita em lote desativada e sequência confirmada por revisão. |
| `components/syncMerge.js` | alterado | Chaves legadas preservadas, escrita em lote desativada e sequência confirmada por revisão. |
| `components/syncUtils.js` | alterado | Chaves legadas preservadas, escrita em lote desativada e sequência confirmada por revisão. |
| `lib/db.js` | alterado | Autenticação/criptografia verificadas; SQL parametrizado; adaptador isolado guardado. |
| `lib/password.js` | alterado | Autenticação/criptografia verificadas; SQL parametrizado; adaptador isolado guardado. |
| `lib/serverAuth.js` | alterado | Autenticação/criptografia verificadas; SQL parametrizado; adaptador isolado guardado. |
| `migrations/001_atomic_sync.sql` | alterado | Migração antiga preservada como referência e bloqueada para execução. |
| `package-lock.json` | alterado | Versões alinhadas; Next atualizado; testes e dependências declarados. |
| `package.json` | alterado | Versões alinhadas; Next atualizado; testes e dependências declarados. |
| `public/delta-vet-logo.jpg` | inalterado | Logotipo preservado byte a byte; sem alteração visual. |
| `scripts/db-init.mjs` | alterado | Inicialização perigosa bloqueada; migração incremental explícita e transacional. |
| `scripts/db-migrate.mjs` | alterado | Inicialização perigosa bloqueada; migração incremental explícita e transacional. |
| `tests/browser.mjs` | alterado | Substituído teste com API interceptada/dependência ausente por PostgreSQL e API reais. |
| `tests/regression.test.mjs` | alterado | Substituído teste com API interceptada/dependência ausente por PostgreSQL e API reais. |

## Arquivos adicionados

- `app/api/records/route.js`
- `app/api/tv/pair/route.js`
- `app/master/recuperacao/page.js`
- `components/confirmedStore.js`
- `docs/AUDITORIA-INICIAL.md`
- `docs/BACKUP-IMPLANTACAO.md`
- `lib/adminOperations.js`
- `lib/operations.js`
- `middleware.js`
- `migrations/002_confirmed_operations.sql`
- `tests/browser-real.mjs`
- `tests/evidence/browser.json`
- `tests/evidence/build.log`
- `tests/evidence/database.json`
- `tests/evidence/dependencies.json`
- `tests/evidence/server.log`
- `tests/integration.mjs`
- `tests/run.sh`
- `tests/schema.sql`
- `tests/setup.mjs`

Hashes detalhados em `manifesto-original.json`. Novos documentos/evidências finais são incluídos no pacote.

Documentos finais: `docs/RELATORIO-FINAL.md`, `docs/ARQUIVOS.md`, `docs/manifesto-original.json`, `docs/SHA256SUMS.txt`, `tests/evidence/resumo.json`, `tests/evidence/execucao.log`.
