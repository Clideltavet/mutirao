# Controle Delta Vet v1.15

## Auditoria por usuário

O sistema agora registra quem realizou as principais ações operacionais.

Ações auditadas:
- entrada cadastrada;
- edição do cadastro do paciente;
- cirurgia confirmada;
- alta liberada;
- entrega confirmada;
- cancelamento de alta / retorno ao pós-operatório;
- reinternação após entrega;
- cadastro e edição de cliente/tutor.

Cada registro guarda:
- data e hora;
- nome do usuário;
- usuário de login;
- origem do acesso;
- ação executada;
- ficha;
- paciente;
- tutor;
- detalhes da ação.

## Relatórios

Nova aba:
- AUDITORIA

Ela mostra:
- quantidade de ações;
- quantidade de usuários/origens;
- ações por usuário;
- última ação de cada usuário;
- histórico detalhado;
- pesquisa por usuário, ação, ficha, paciente e tutor;
- filtro pelo mesmo período dos relatórios.

Exemplo:
Luiza (@luiza) → Entrega confirmada → Ficha 025 → Thor → 16:42.

## TV da cirurgia

A TV continua sem login, conforme definido.
Por isso, ações feitas diretamente na TV aparecem como:

TV Sala de Cirurgia (@tv-cirurgia)

O veterinário selecionado continua sendo registrado separadamente.

## Prontuário / Anamnese

A linha do tempo do paciente também passa a mostrar:
- "Feito por: Nome do usuário (@usuario)"

IMPORTANTE:
A auditoria desta versão ainda usa localStorage.
Quando o sistema for ligado ao Neon, o histórico de auditoria passará para o banco
e será compartilhado entre tablet, recepção, TV e computador.

Versão: 1.15.0
