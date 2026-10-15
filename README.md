# Controle Delta Vet v1.17 — dados compartilhados no Neon

Esta versão corrige o problema de entradas feitas em um aparelho não aparecerem nos outros.

## Agora ficam compartilhados no Neon

- pacientes / entradas;
- clientes / tutores;
- procedimentos e valores;
- cirurgia e status do paciente;
- alta;
- entrega;
- observações;
- auditoria;
- próxima numeração de ficha.

Usuários, senhas, funções e permissões já estavam no Neon desde a v1.16.

## MUITO IMPORTANTE — os dados antigos não são apagados

A v1.17 foi feita para importar automaticamente o que já estava salvo no navegador.

A primeira sincronização segue esta ordem:

1. lê os registros que já existem naquele computador/tablet;
2. envia esses registros primeiro para o Neon;
3. o Neon mescla os dados sem duplicar;
4. somente depois o dispositivo recebe o banco compartilhado.

Ou seja: o sistema NÃO baixa um banco vazio por cima das entradas antigas.

### Para preservar as entradas que a cliente já fez

Depois de publicar a v1.17:

1. NÃO limpe cache, dados do site ou localStorage;
2. abra primeiro o sistema NO MESMO computador e NO MESMO navegador em que as entradas foram cadastradas;
3. espere aparecer `NEON SINCRONIZADO`;
4. confira se os pacientes continuam aparecendo;
5. só depois abra o tablet.

Nesse momento, o tablet passa a baixar os mesmos registros do Neon.

## Sincronização entre aparelhos

A sincronização ocorre automaticamente aproximadamente a cada 1,8 segundo.

Exemplo:

PC / Recepção
→ cadastra animal
→ Neon
→ Tablet
→ TV da cirurgia
→ CMS / Relatórios

Se a internet cair:
- o aparelho continua mantendo os dados localmente;
- quando a conexão retorna, tenta sincronizar novamente.

## Proteção contra duplicidade

Pacientes antigos usam:
- número da ficha;
- data/hora original de criação.

Clientes, procedimentos e auditoria usam suas próprias chaves.

## Exclusões

Exclusões de clientes e procedimentos também são enviadas ao Neon.

## Atualização do banco

Depois de atualizar da v1.16 para a v1.17, rode novamente:

npm install
npm run db:init

O `db:init` usa `CREATE TABLE IF NOT EXISTS`, portanto NÃO apaga usuários ou tabelas já existentes.

Ele adiciona:

- `shared_records`
- `system_state`

## Vercel

A variável abaixo continua obrigatória:

DATABASE_URL

Depois do novo deploy, faça primeiro a migração no navegador que contém os registros antigos.

## Indicador de sincronização

O sistema mostra:

- `NEON SINCRONIZADO` → banco online atualizado;
- `SINCRONIZANDO...` → aguardando primeira sincronização;
- `MODO LOCAL` → dispositivo está sem internet.

Versão: 1.17.0
