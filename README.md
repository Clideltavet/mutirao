# Controle Delta Vet v1.17.4 — correção definitiva da sequência de fichas

## Problema corrigido

Nas versões anteriores, o campo:

CMS → Configurações → Próxima ficha

era alterado apenas no navegador/localStorage.

Além disso, a sincronização recalculava a sequência a partir das fichas históricas.
Por isso a cliente podia colocar, por exemplo, 150 nas Configurações e a tela Entrada
continuava mostrando o número antigo.

## Agora a configuração fica no Neon

Foi criada a API:

- GET /api/admin/settings/sequence
- PATCH /api/admin/settings/sequence

O Administrador salva a próxima ficha diretamente em `system_state` no Neon.

Ao salvar:

1. o Neon grava exatamente o número informado;
2. o computador atual é atualizado imediatamente;
3. a sincronização avisa as telas abertas;
4. tablet e outros aparelhos recebem a nova sequência;
5. a tela Entrada passa a mostrar o novo número.

## Exemplo

Administrador configura:

150

A tela Entrada mostrará:

Paciente nº 150

Depois de cadastrar essa ficha:

151

Depois:

152
153
154...

## Reiniciar sequência

Também é permitido informar:

1

mesmo que existam fichas 001, 002 e 003 de mutirões antigos.

Isso NÃO apaga os registros antigos.

O sistema registra um `epoch` no Neon para identificar o início da nova sequência,
então somente fichas criadas depois dessa alteração fazem a sequência avançar.

## Importante

Agora o servidor é a fonte oficial da numeração.

Valores antigos de localStorage de outro tablet/computador não conseguem mais
sobrescrever uma sequência alterada pelo Administrador.

## Atualização

Depois de publicar:

npm install
npm run db:init

Nenhuma tabela é apagada.

Versão: 1.17.4
