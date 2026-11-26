# Controle Delta Vet — relatório técnico de entrega

Data: 26/11/2026. Versão corrigida: 1.19.0. Origem: `mutirao-main (1).zip`, commit informado pelo ZIP `552412a8730f2ea67ccbffc92ac44e2a4b5bb974`.

## Resultado e limite da conclusão
A correção foi implementada sobre as telas existentes e validada com PostgreSQL real isolado, servidor Next.js de produção local e navegadores independentes. Não houve conexão ao banco Neon da cliente, publicação no GitHub, deployment Vercel, alteração de senhas existentes ou execução de migração em produção.

É uma entrega para homologação e implantação controlada. O ZIP não contém dump/logs do incidente nem prova de qual registro real foi perdido. As causas abaixo são defeitos observados no código; a reconstrução de cada atendimento real depende das fontes de recuperação descritas em BACKUP-IMPLANTACAO.md. Não afirmar que registros desaparecidos já foram recuperados.

## Diagnóstico das causas

| Causa comprovada no código recebido | Efeito possível observado pela cliente | Correção |
|---|---|---|
| GET/POST de sincronização sem autenticação | Consulta indevida e alteração/exclusão por requisições não autorizadas | Autenticação por sessão ou dispositivo pareado; autorização por operação |
| Navegador envia todos os pacientes, clientes, procedimentos e auditoria a cada 1,8 s | Cache antigo pode substituir informações mais recentes | Sincronização passa a ser GET somente; POST legado recebe 410 |
| Last-write-wins por horário do cliente, aceitando empate | Relógio errado e dados obsoletos ganham disputa | Revisão mantida no banco, obrigatória; conflito retorna 409 |
| Tombstone e exclusão física em consultas separadas; tombstone pode ser apagado por data futura | Perda parcial, ressurreição e diferença entre aparelhos | Comando único em transação; exclusão lógica permanente; payload preservado |
| Resposta remota substitui cache durante edição; fila de exclusão inteira é limpa | Operação local desaparece ou fica sem confirmação | Cache confirmado por aba, revisão global e diário individual de comandos; fila antiga preservada |
| Duas implementações de cadastro; formulário recria ID a cada envio | Reenvio após timeout pode criar outro paciente; caminho antigo pode trocar ficha | Um único comando; ID e requestId persistentes; recibo idempotente no banco |
| Edição/alta/cirurgia/saída fazem map por número | Todos os registros antigos com mesma ficha podem mudar juntos | Endereçamento por `kind + record_key`, inclusive URLs e registros legados |
| Alteração administrativa de sequência sem comparação de revisão | Configuração concorre com cadastro e perde atualização | Mesmo lock/transação; revisão de sequência obrigatória; época explícita para novo mutirão |
| Veterinários/adicionais e tela antiga de configuração só locais | Configurações não chegam a outros aparelhos | Configuração oficial versionada no banco; recuperação explícita das listas legadas |
| Modais fecham e relatórios retiram registro antes de confirmar banco | Sucesso aparente sem persistência | Aguardar confirmação; erro mantém formulário/modal e informa pendência |
| Edição recalcula valores antigos pelo catálogo atual | Financeiro histórico muda sem ajuste financeiro autorizado | Valores históricos mantidos; preço novo calculado no servidor apenas para procedimento novo/alterado |
| Ausência de valor histórico usa preço atual, null vira zero | Totais aparentam exatos sem base histórica | Totais conhecidos e aviso de valores desconhecidos; CSV sinaliza ausência |
| CADASTROS permite elevação de privilégios; PATCH de usuários em vários commits | Escalada de acesso, alteração parcial e sucesso sem alvo | Controle de autoridade, revisão, transação, histórico e revogação de sessão |
| db:init redefine senha/admin existentes | Reset involuntário durante manutenção | Script bloqueado; migração 002 não muda senhas ou permissões |
| Testes antigos importam função ausente e interceptam API | Aprovação aparente sem verificar rotas reais | Suíte reproduzível contra PostgreSQL e HTTP reais |

A mensagem “Neon não sincronizado” também pode decorrer de credenciais, rede, schema ou função SQL ausente. Sem logs do deployment não foi possível atribuir esse aviso a uma única causa operacional. Agora erros não se convertem em sucesso e operações pendentes permanecem identificáveis.

## Arquitetura final

A criação, atualização, exclusão lógica, recuperação e configuração são comandos individuais. A função `delta2_apply` executa sob lock transacional, confere revisão, registra a mudança e a auditoria, atribui ficha quando necessário e grava o recibo idempotente na mesma transação. Falha reverte todas essas etapas. Horário do servidor e identidade autenticada substituem autoria/horário informados pelo navegador para ações novas.

A sequência mantém a possibilidade existente de iniciar outro mutirão em 001. Portanto, números antigos repetidos são permitidos e preservados; identidade única não é o número exibido. Novas alocações são únicas dentro da época da sequência e verificam colisões legadas. Alterar a sequência não renumera nenhum paciente.

As operações normais nunca importam um snapshot local. O localStorage legado fica intacto. Cache confirmado em sessionStorage é separado por aba; o diário persistente grava cada comando em chave própria, evitando que duas abas substituam uma fila compartilhada. Um rascunho de entrada permanece na aba durante recarregamento; o diário local preserva o comando mesmo após fechamento. Não há limpeza automática dessas fontes.

A TV mantém uso sem login diário após pareamento explícito pelo administrador no navegador. Cookie HttpOnly por 90 dias; permissões limitadas a confirmar cirurgia/liberar alta. API da TV retorna somente os campos operacionais do dia, sem CPF, telefone ou valores. O acesso público irrestrito anterior foi fechado. Essa é uma mudança de segurança necessária, não uma remoção da tela.

Exclusões de pacientes exigem administrador, revisão e motivo. A tela mantém as duas confirmações. O registro sai das listas/financeiro somente após commit e fica em `shared_records`, com tombstone e histórico. Não existe endpoint que limpe tombstones ou renumere antigos.

Histórico/auditoria anterior no banco é mantido. Auditoria nova é criada pelo servidor na transação, com usuário real; modificação administrativa também gera histórico. Permissões de usuários existentes não são recalculadas automaticamente por alterações em templates de função, preservando a semântica de acessos individuais do sistema anterior.

## Segurança e dependências
Next.js atualizado de 14.2.31 para 16.4.6 devido às vulnerabilidades reportadas pela auditoria, incluindo problemas não resolvidos pelo patch 14.2.35. APIs de cookies adaptadas à leitura assíncrona. Node mínimo 20.9; execução validada em Node 24.22.3. Build usa Webpack explicitamente. CSS e logo permanecem idênticos aos originais; telas existentes não foram recriadas.

Hash scrypt/salt e comparação em tempo constante mantidos. SQL parametrizado. Escritas aceitam JSON e verificam origem; limite de tentativas de login fica no PostgreSQL, compartilhado entre instâncias. Administradores existentes não tiveram senha alterada. A função de troca de senha continua disponível apenas quando solicitada explicitamente pela interface e autorizada pelo servidor.

`npm audit --omit=dev` reportou zero vulnerabilidades no conjunto de dependências de produção da entrega. Isso descreve a base de avisos consultada, não é garantia de ausência de toda vulnerabilidade.

## Validação executada
Evidências: `tests/evidence/database.json`, `browser.json`, `build.log`, `dependencies.json` e `server.log`. As mensagens 4xx de testes negativos no log são esperadas.

### PostgreSQL 17.12 real — 12 cenários
1. Migração reaplicada duas vezes com igualdade dos payloads e hashes de senha antes/depois.
2. Cadastro de catálogo, tutor e configuração com confirmação.
3. 16 conexões concorrentes: fichas 500 a 515, sem duplicidade, próxima 516.
4. Mesmo requestId retorna o mesmo recibo; alteração do conteúdo com o mesmo requestId é recusada.
5. Duas edições sobre a mesma revisão: uma confirma e outra recebe conflito.
6. Duas fichas antigas 001: edição atinge somente o record_key escolhido e mantém preço de R$ 80.
7. Reset administrativo preserva números antigos; configuração com revisão vencida é recusada.
8. Exclusão não autorizada é recusada; exclusão de teste autorizada preserva payload; tombstone bloqueia ressurreição.
9. Recuperação de registro ausente preserva número; segunda inserção não sobrescreve o existente.
10. Cirurgia, alta separada, entrega e reinternação com linha do tempo e auditoria.
11. Escritor legado bloqueado; falha de transação não consome ficha nem cria paciente.
12. Alteração do preço do catálogo não muda atendimento antigo; atendimento novo usa preço novo.

O PostgreSQL é reiniciado após esses testes. Os testes HTTP seguintes leem os mesmos dados persistidos após o reinício.

### Chromium + Next.js local — 11 cenários
1. Login real, cookie HttpOnly, sessão válida e senha inválida recusada.
2. Sem login/recepção não gravam; POST de snapshot recusado; origem externa bloqueada; dados financeiros não enviados à recepção.
3. Dois contextos de navegador independentes cadastram simultaneamente por API real.
4. Desconexão não exibe sucesso nem grava; reconexão/reload retoma rascunho sem duplicar.
5. Servidor confirma commit, resposta é abortada de propósito; reload/reenvio não duplica.
6. localStorage legado é preservado e não enviado pela sincronização.
7. Rota de edição por identidade preserva outro paciente com mesmo número e mantém valor histórico.
8. Abertura das telas existentes de cadastro, pacientes, saída, cirurgia, recepção, configurações, CMS e relatórios; exportação CSV.
9. Administração de usuários/funções com revisão e impedimento de elevação de permissão.
10. Soma do CSV confere, em centavos, com valores confirmados do banco; histórico antigo não recebe preço novo.
11. TV pareada funciona após logout e não pode criar paciente ou acessar dados financeiros/contato.

Não há mocks de banco, login ou endpoints. A interceptação do navegador é usada apenas para simular perda da resposta depois de uma gravação real. A suíte fecha navegadores e encerra seu banco de teste ao terminar. Nenhum paciente real é usado.

Build completo do Next.js, incluindo compilação, geração das páginas e rastreamento das rotas: aprovado. Não foi usado apenas teste de sintaxe.

## O que continua exigindo homologação
- Repetir a migração em cópia restaurada do Neon real, conferindo extensões, schema e registros efetivos, porque o banco real não foi fornecido.
- Conferir recovery de cada dispositivo e listas que só existiam localmente; não importar automaticamente.
- Validar impressão/layout nos tablets/TV reais. Abertura funcional automatizada não equivale a uma revisão visual de todos os estados e resoluções.
- Configurar Node compatível e separar DATABASE_URL de Preview/Production na Vercel; testar TLS/rede/driver Neon no preview com branch isolada. O PostgreSQL local valida SQL/concorrência; não simula infraestrutura Neon/Vercel.
- A leitura ainda retorna coleções completas, como o sistema existente. Para volume muito alto, medir custo/latência e planejar paginação; o lock conservador prioriza consistência.
- LocalStorage/diário retém dados para recuperação conforme exigido. Estabelecer exportação e retenção controlada; não há limpeza automática.
- Recuperação de dados fisicamente apagados anteriormente só é possível se alguma fonte preservada contiver o conteúdo. Tombstones antigos sozinhos não reconstituem pacientes.

## Entregáveis
Projeto completo, diagnóstico inicial/final, inventário por arquivo com hashes, migração 002, testes reproduzíveis e evidências, procedimento de backup/restauração, recuperação sem overwrite, comandos de GitHub, corte de versão e rollback seguro estão neste ZIP. Começar por `docs/BACKUP-IMPLANTACAO.md`. Nenhuma publicação foi realizada.
