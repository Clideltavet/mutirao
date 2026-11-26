# Controle Delta Vet 1.19.0 — integridade de dados

Correção sobre o projeto existente. Não publicar sem ensaio em homologação e backup restaurado/conferido. Não executar `db:init` ou a migração 001. Não usar conexão de produção nos testes.

## Documentação da entrega
- `docs/AUDITORIA-INICIAL.md`: diagnóstico antes das alterações.
- `docs/RELATORIO-FINAL.md`: causas, solução, limites e resultados.
- `docs/ARQUIVOS.md`: inventário por arquivo e alterações.
- `docs/BACKUP-IMPLANTACAO.md`: backup, recuperação, GitHub, implantação e rollback.
- `migrations/002_confirmed_operations.sql`: migração incremental transacional.
- `tests/evidence/`: evidências reais de banco, navegador, build e dependências.

## Requisitos
Node.js 20.9+ (validado em Node 24); Next.js 16.4.6; PostgreSQL/Neon. Configurar `DATABASE_URL` no ambiente de execução. Preview deve usar branch Neon separada. Não colocar `.env` no ZIP/Git.

```bash
npm ci
npm run build
npm start
```

Não há migração automática no build ou no start. A configuração de produção deve ser feita somente conforme o procedimento de implantação.

## Testes isolados
Em Linux/WSL x64, `npm test` inicia PostgreSQL local descartável em diretório temporário, cria dados fictícios, executa testes SQL concorrentes, reinicia o banco, faz build e testa as telas/API reais em Chromium. Não lê `.env` nem aceita destino remoto. Portas 55432 e 3000 precisam estar livres. `npm run test:db` executa só a parte SQL. Pode definir `DELTA_PG_BIN` com binários PostgreSQL locais e `CHROMIUM_PATH` com Chromium compatível.

## Comportamento
- Neon é autoridade; sincronizar significa ler dados confirmados, nunca enviar todo o navegador.
- Cadastro individual com ID estável/reenvio idempotente; número é atribuído em transação com histórico/auditoria.
- Alterações exigem revisão; conflitos retornam HTTP 409 e pedem nova leitura/revisão humana.
- Ficha é identificada por record_key. Números antigos e reinício por mutirão são preservados.
- Exclusão confirmada pelo administrador é lógica, com motivo, tombstone permanente e histórico recuperável.
- LocalStorage legado nunca é limpo, importado ou sobrescrito automaticamente. Cache confirmado fica por aba; comandos individuais ficam preservados no diário local.
- TV precisa ser pareada uma vez no navegador pelo administrador; depois funciona sem login diário por 90 dias, limitada a cirurgia/alta.
- Preços históricos não são recalculados pelo catálogo atual. Registros antigos sem preço são explicitamente apontados no relatório.
- Usuários e funções têm revisão e transação; permissões não são elevadas por um usuário sem autoridade. Senhas existentes são preservadas.

Não se trata de monitoramento contínuo contratado: manutenção futura depende de novos incidentes, logs e versões disponibilizados. Esta entrega não modifica a infraestrutura da cliente automaticamente.
