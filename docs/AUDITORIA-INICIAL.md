# Auditoria antes das alterações — 26/11/2026
Origem: ZIP mutirao-main (1).zip, comentário Git 552412a8730f2ea67ccbffc92ac44e2a4b5bb974. Não há dump, logs Neon/Vercel ou credenciais no ZIP. Causas de código abaixo são demonstráveis; a atribuição de cada perda real exige logs e comparação de backups.

- CRÍTICO: app/api/sync/shared/route.js GET/POST públicos. POST importa snapshots inteiros, permite excluir pacientes/clientes/procedimentos/auditoria, confia em timestamps do cliente (inclusive empate >=). Exclusão, tombstone e gravação em consultas separadas, sem transação conjunta.
- CRÍTICO: SharedDataSync aplica resposta substituindo cache inteiro, mesmo se houve edição durante a requisição. clearSyncDeletes limpa toda fila, inclusive exclusões posteriores ao envio. Nenhuma confirmação individual nem conflito explícito.
- CRÍTICO: operações por Number(number) em Cirurgia, Saída, modais e edição alteram todos os pacientes com número igual. Rotas por número abrem o primeiro histórico encontrado.
- ALTO: entry/route usa delta_vet_create_patient; patients/route usa delta_apply. A migração 001 não está integrada ao caminho usado pela Entrada. Reenvio no caminho antigo troca número por ON CONFLICT UPDATE; formulário cria novo ID a cada tentativa.
- ALTO: sequência administrativa faz read/modify/write sem controle de revisão, concorre com criação. Reset cria época que permite números repetidos no histórico, mas UI usa número como identidade.
- ALTO: scripts/db-init atualiza senha e permissões existentes. db-migrate tenta separar SQL por CREATE e não integra init.
- ALTO: veterinários/adicionais e configuração antiga persistem somente localmente. Catálogo padrão é gravado na montagem, podendo reaparecer após exclusão.
- ALTO: cirurgia/alta/saída/edição/clientes mostram sucesso ou fecham modal antes da confirmação no banco. Sem tratamento persistente de resposta perdida.
- ALTO: preços de pacientes são recalculados com catálogo atual ao editar; registros sem detalhes usam preço atual no relatório; null total vira 0. Somatórios em ponto flutuante. CSV aceita fórmulas de planilha.
- ALTO: usuários com CADASTROS podem atribuir MASTER/admin e redefinir qualquer senha. PATCH usuários tem múltiplos commits e sucesso mesmo sem alvo. Não há controle de versão para usuários/funções.
- MÉDIO: gate de /configuracoes aceita qualquer login; gate CMS não distingue subpermissões. Cookie HttpOnly, hash scrypt com salt e SQL parametrizado são pontos positivos.
- MÉDIO: auditoria é fabricável pelo browser e limitada a 10000 entradas locais. Não há vínculo transacional com a ação.
- MÉDIO: relatórios/telas filtram dia de criação: paciente pode apenas estar fora do filtro, sem ter sido apagado.
- TESTES: regression importa preserveProcedureDetails inexistente e dependências não declaradas. browser intercepta API; não testa rotas reais. package.json 1.17.6, lock 1.18.1 e changelog 1.18.0 divergentes.

Revisão: todos os arquivos fonte, APIs, scripts, migrações, testes e documentação inventariados; CSS (3866 linhas, sem imports/URLs externos) e JPEG preservados. Manifesto SHA-256 acompanha entrega. Nenhuma alteração feita na cópia original.

Decisões: Neon oficial; cache confirmado em namespace separado preserva localStorage legado; leituras não enviam dados; comando individual com revisão obrigatória e idempotência; soft delete com histórico e motivo; sequência com transação/época/revisão; identidade por record_key; preço histórico preservado; recuperação explícita, nunca importação automática; pareamento de TV por administrador sem login diário.
