# Controle Delta Vet v1.17.1 — correção da numeração das fichas

Esta versão corrige o problema de o sistema pular números de ficha depois da sincronização entre aparelhos.

## O que causava o problema

Cada aparelho possuía um valor local chamado `deltaVetNextPatientNumber`.

Na v1.17, durante a primeira sincronização, o Neon aceitava o MAIOR valor encontrado entre:
- número local do PC;
- número local do tablet;
- número salvo no Neon;
- maior ficha existente + 1.

Se um aparelho antigo tivesse, por exemplo, `10` salvo localmente enquanto a última ficha real era `3`,
o Neon podia assumir que a próxima ficha era `10`.

Isso fazia o sistema pular:
4, 5, 6, 7, 8 e 9.

## Nova regra

Se já existe pelo menos um paciente no Neon:

PRÓXIMA FICHA = MAIOR FICHA EXISTENTE + 1

Exemplo:

001
002
003

A próxima será obrigatoriamente:

004

O número local antigo de outro aparelho não consegue mais empurrar a sequência para frente.

## Numeração inicial

Se ainda NÃO existe nenhum paciente, o sistema continua respeitando a numeração inicial configurada.

## Tela Entrada

Se a tela Entrada estiver aberta e outro aparelho cadastrar um paciente,
a sincronização atualiza o próximo número na própria tela.

## Dados existentes

Nenhum paciente é apagado ou renumerado por esta correção.

A v1.17.1 apenas corrige QUAL SERÁ A PRÓXIMA FICHA.

## Atualização

Depois de publicar:

npm install
npm run db:init

O db:init não apaga dados.

Em seguida, abra o sistema e espere aparecer:

NEON SINCRONIZADO

A própria sincronização recalcula a próxima ficha usando os pacientes que já existem.

Versão: 1.17.1
