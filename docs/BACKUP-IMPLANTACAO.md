# Backup, recuperação, implantação e rollback

## Restrições desta entrega
Nenhuma conexão ao Neon de produção foi realizada. Nenhuma senha real foi lida, alterada ou resetada. Não executar `db:init`, migração 001, nem retornar o código antigo à escrita após a migração 002. Os testes usam exclusivamente PostgreSQL local e dados fictícios.

## Antes de qualquer migração
1. Identificar projeto, branch, database e versão PostgreSQL do Neon usado pela produção; registrar commit implantado na Vercel e configurações (sem publicar segredos).
2. Agendar janela de manutenção; pausar uso em todos os dispositivos e bloquear tráfego de escrita dos deployments atuais e anteriores na Vercel. Apenas fechar a aba não basta para impedir requisições antigas.
3. Em cada aparelho, exportar os dados locais ANTES de recarregar. Não limpar cache, localStorage ou dados do site. O arquivo contém dados pessoais; armazenar com acesso restrito. Código de exportação manual no console do navegador:

```js
const data = Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('deltaVet')).map(k => [k, localStorage.getItem(k)]));
const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
const a=document.createElement('a');a.href=url;a.download='delta-vet-dispositivo-backup.json';a.click();URL.revokeObjectURL(url);
```

4. Fazer dump completo, consistente, usando ferramentas da mesma versão major do servidor ou superior. Usar conexão DIRETA Neon (não pooler). Obter credencial pelo canal seguro existente; não colocá-la no Git nem em prints. Com `PGSERVICE=delta_producao_leitura` configurado em pg_service.conf/pgpass com permissão restrita:

```bash
umask 077
PGSERVICE=delta_producao_leitura pg_dump --format=custom --no-owner --no-acl --file=delta-vet-antes.dump
sha256sum delta-vet-antes.dump > delta-vet-antes.dump.sha256
pg_restore --list delta-vet-antes.dump > delta-vet-antes-conteudo.txt
```

5. Criar banco/branch **separado** para restauração. Nunca restaurar por cima do banco de produção. Validar hash, restaurar sem `--clean`, conferir quantidade por kind, números duplicados antigos, configuração de sequência, usuários, hashes de senha, tombstones, financeiro e auditoria:

```bash
sha256sum --check delta-vet-antes.dump.sha256
PGSERVICE=delta_homologacao_vazia pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname=delta_homologacao delta-vet-antes.dump
```

O serviço de homologação deve apontar explicitamente para o banco vazio indicado em `--dbname`. Ajustar esse nome ao ambiente real. Conferir a conexão antes de executar. A simples criação do arquivo não prova que o backup pode ser restaurado.

6. No Neon, registrar a janela de histórico disponível e, se disponível, criar branch/snapshot de segurança. Os recursos e a retenção dependem do projeto/plano. Não presumir que há histórico suficiente.

## Diagnóstico e recuperação de desaparecidos
- Primeiro consultar todo o histórico, data de entrada, status e filtros: as telas operacionais antigas só mostravam o dia atual.
- Comparar por `kind + record_key`, não por número da ficha. Números podem repetir entre mutirões.
- Comparar `shared_records`, `shared_tombstones`, `shared_record_versions` (se existir), `delta_history` (depois da 002), backups locais e dump. Tombstone antigo nem sempre tem payload; a antiga exclusão física pode exigir backup/PITR.
- Se houver retenção Neon, criar uma branch separada a partir de um instante anterior ao incidente. Não restaurar/resetar a branch atual. Extrair somente candidatos desaparecidos para revisão.
- A tela adicional `/master/recuperacao` permite comparar JSON do backup de navegador com o estado atual. Só o administrador pode confirmar um registro por vez, com motivo. Registros que já existem nunca são sobrescritos. Identidades com tombstone são bloqueadas: recuperação delas exige revisão específica, preservando a referência ao ID anterior; não remover tombstones para tentar forçar importação.
- Um registro ausente pode corresponder ao mesmo atendimento com ID diferente. Conferir tutor, paciente, horário, telefone e ficha antes de inserir. Não há como deduzir automaticamente a identidade clínica com segurança.
- Sem backup, versão anterior ou histórico Neon disponível, não é possível garantir recuperação de registros fisicamente apagados pela versão antiga.

## Migração 002
Adiciona tabelas de versões, comandos idempotentes, alocações, dispositivos, limites de login e histórico; adiciona revisão a usuários/funções. Não altera payloads, números, preços, senhas ou permissões existentes. Triggers bloqueiam escritores legados e exclusão física nas tabelas compartilhadas. Isto exige corte coordenado de versão.

Após backup RESTAURADO e verificado, executar primeiro na homologação:

```bash
export DELTA_MIGRATION_URL='conexao-direta-da-homologacao'
export DELTA_BACKUP_VERIFIED='identificador-do-backup-verificado'
npm ci
npm run db:migrate
npm run build
```

A URL é placeholder: definir de modo seguro, sem deixá-la em histórico compartilhado. Não usar a conexão de produção nos testes. A migração é uma única transação com lock/statement timeout, reaplicável. Não rodar junto com a migração 001.

## GitHub e Vercel
No clone local da branch realmente publicada, abrir branch de trabalho e copiar os arquivos deste pacote, excluindo evidências privadas, `.env`, `node_modules` e `.next`. Revisar o diff:

```bash
git switch -c fix/delta-vet-integridade
git status --short
git diff --check
git add app components lib migrations scripts tests docs middleware.js package.json package-lock.json README.md .gitignore
git diff --cached --stat
git commit -m "Corrige persistência, concorrência e integridade do Delta Vet"
git push -u origin fix/delta-vet-integridade
```

Abrir PR. Preview Vercel deve usar **somente branch Neon de homologação**, em variável DATABASE_URL de Preview; conferir antes do primeiro acesso. Não definir DELTA_ISOLATED_TEST na Vercel. Não vincular branch nova a produção automaticamente.

Veterinários/adicionais que existiam apenas no navegador precisam de recuperação explícita na tela de recuperação, a partir do aparelho/backup correto. Conferir também catálogo e tutores antes de reabrir. Auditorias exclusivamente locais permanecem no backup e devem ser reconciliadas separadamente, sem apresentá-las como ações verificadas do servidor.

Após validação local e homologação com cópia real: janela de manutenção, novo backup verificado, bloquear escritores antigos, aplicar 002 uma vez no destino confirmado, implantar commit aprovado, conferir login e leituras, parear TVs. Cada TV: entrar como administrador nesse navegador, Configurações → Autorizar este navegador como TV; encerrar sessão administrativa; abrir `/cirurgia`. Autorização dura 90 dias e é restrita à cirurgia/alta. Não compartilhar cookies/tokens. Para revogar, administrador técnico marca `revoked_at` do dispositivo em procedimento operacional auditado.

Reabrir gradualmente. Cadastro simultâneo de testes em homologação, e conferência de atendimentos reais em produção sem criar/excluir pacientes reais para teste. Monitorar HTTP 409/401/5xx, contagens e fila de comandos pendentes. Não tratar 409 como falha de rede a ser sobrescrita.

## Rollback seguro
- Falha antes do COMMIT: a migração é revertida inteira. Investigar em homologação.
- Falha após migração/implantação: manter escrita bloqueada e preservar o banco atual. Pode voltar frontend somente com versão compatível com API 002; não voltar ao writer antigo.
- Não desativar triggers, não executar down migration destrutiva, não restaurar dump por cima dos novos atendimentos.
- Para recuperação grave: restaurar backup em **outro banco**, comparar com estado atual e histórico de comandos para preservar operações posteriores; revisar, testar e só depois planejar troca de conexão. O banco atual permanece intacto.
- Durante contingência, registrar atendimentos em formulário externo controlado com identidade temporária e reconciliar individualmente; nunca anunciar gravação no Neon enquanto não confirmada.

## Referências técnicas consultadas
- https://neon.com/docs/manage/backup-pg-dump
- https://neon.com/docs/manage/branches
- https://www.postgresql.org/docs/17/explicit-locking.html
- https://nextjs.org/blog/security-update-2025-12-11

Framework atualizado para Next.js 16.4.6 após auditoria de dependências; configurar Node 24 na Vercel (ou versão >=20.9 suportada). Cookies agora são consultados de modo assíncrono. Referência: https://nextjs.org/docs/app/guides/upgrading/version-16
