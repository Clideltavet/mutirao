# Controle Delta Vet v1.17.6 — ajustes solicitados em 25/11/2026

## 1. Ordem dos pacientes depois da cirurgia

Na tela **Pacientes**, as fichas agora ficam em dois blocos:

1. fichas que ainda aguardam confirmação da cirurgia;
2. fichas com cirurgia confirmada, no final da lista.

Quando uma cirurgia é confirmada, a ficha sai do primeiro bloco e vai automaticamente para o bloco final.
Dentro dos dois blocos, as fichas continuam em **ordem numérica crescente**. Alta e entrega não fazem a ficha voltar para cima.

Exemplo:

Aguardando: 012, 014, 017
Cirurgia confirmada: 003, 009, 011

Ao confirmar a ficha 014, ela vai para o grupo das confirmadas e esse grupo continua numericamente ordenado.

A TV da cirurgia também mantém as listas CIRURGIAS e LIBERAR em ordem numérica.

## 2. Veterinário não é mais obrigatório para alta

No modal **Liberar Alta**:

- o veterinário passou a ser opcional;
- existe a opção **Não informar**;
- a alta pode ser concluída normalmente sem escolher veterinário;
- se um veterinário for informado, ele continua registrado no prontuário e na auditoria.

## 3. Relatórios — Observações / Alterações

Em **Relatórios e Financeiro → Pacientes**, foi adicionada uma coluna entre:

**Procedimentos → Observações / Alterações → Valor**

Ela mostra de forma compacta:

- observação da entrada;
- observação do procedimento;
- observação da alta;
- observação da entrega;
- quantidade de alterações registradas na linha do tempo.

As observações/alterações também entraram na pesquisa e na exportação CSV.

O detalhamento completo continua disponível em **VER FICHA**.

## 4. Exclusão dos registros de teste

Para Administrador, em:

**Relatórios e Financeiro → Pacientes**

agora aparece diretamente na linha o botão:

**EXCLUIR TESTE**

Não é mais necessário entrar primeiro em VER FICHA para encontrar a exclusão.

A exclusão continua com duas confirmações para evitar acidente.
Depois da confirmação:

- o paciente sai imediatamente da lista;
- deixa de contabilizar nos valores do dia, período, histórico e pesquisa;
- deixa de contabilizar por tutor e procedimento;
- entra na fila de exclusão do Neon;
- o sistema força uma sincronização manual imediatamente;
- a exclusão continua protegida pelos tombstones para não reaparecer por outro aparelho antigo.

O botão dentro de **VER FICHA** também continua disponível para Administrador.

Versão: 1.17.6
