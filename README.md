# Controle Delta Vet v1.17.3 — botão SINCRONIZAR NEON

Novo botão manual para forçar a sincronização com o Neon.

## Onde aparece
- tela inicial do tablet;
- Painel CMS;
- Recepção;
- Painel Pacientes;
- Sala de Cirurgia.

## Feedback
Ao clicar:
- muda para `SINCRONIZANDO...`;
- envia primeiro os dados locais;
- recebe os dados consolidados do Neon;
- confirma sucesso ou mostra erro.

Sucesso:
- `Neon sincronizado`;
- quantidade de pacientes sincronizados;
- horário da última confirmação.

Falha:
- `Falha na sincronização`;
- mensagem de erro;
- botão vira `TENTAR NOVAMENTE`.

Sem internet:
- `SEM INTERNET` / `Modo local`.

A sincronização automática continua rodando aproximadamente a cada 1,8 segundo.
O botão é uma confirmação manual adicional.

Versão: 1.17.3
