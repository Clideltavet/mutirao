# Controle Delta Vet v1.17.2 — exclusão segura de testes

## Clientes / Tutores

No CMS → Cadastros → Clientes / Tutores:

### Tutor sem animais vinculados
Pode ser excluído normalmente.

### Tutor com animais vinculados
O sistema mostra proteção e oferece duas possibilidades:

- ARQUIVAR
  - deixa de aparecer na seleção da Entrada;
  - preserva o cadastro;
  - preserva todos os animais e históricos;
  - pode ser reativado depois.

- EXCLUIR CADASTRO
  - exige confirmação;
  - exige digitar EXCLUIR;
  - remove apenas o cadastro central do tutor;
  - NÃO apaga os animais nem os prontuários já existentes.

## Registro de paciente de teste

No CMS → Relatórios → PACIENTES → VER FICHA:

Se o usuário logado tiver a função Administrador (`roleId = admin`),
o prontuário mostra o botão:

EXCLUIR REGISTRO DE TESTE

A exclusão possui duas etapas:
1. confirmação mostrando ficha, paciente e tutor;
2. digitar EXCLUIR.

Depois disso:
- o paciente sai da lista local;
- a exclusão entra na fila de sincronização;
- o registro é removido do Neon;
- a auditoria registra quem excluiu o teste.

Usuários que não são Administrador NÃO veem esse botão.

## Proteção contra reaparecimento após exclusão

Foi adicionada a tabela:

shared_tombstones

Ela guarda uma marca de exclusão no Neon.

Isso impede que um tablet ou PC antigo, ainda contendo uma cópia local do registro,
mande esse registro de volta e faça o tutor/paciente reaparecer depois de excluído.

## Atualização do banco

Depois de publicar a v1.17.2, rode:

npm install
npm run db:init

O comando NÃO apaga dados existentes.
Ele apenas cria `shared_tombstones` caso ainda não exista.

Versão: 1.17.2
