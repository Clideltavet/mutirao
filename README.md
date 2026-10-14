# Controle Delta Vet v1.16 — Neon: usuários e login

Esta versão inicia a migração definitiva para o Neon.

## O que já foi para o Neon nesta versão

- usuários;
- senhas;
- funções;
- permissões;
- sessões de login.

As senhas NÃO são gravadas em texto puro.
O servidor usa hash `scrypt` com salt individual.

A sessão é mantida por cookie HTTP-only e também validada no servidor.

## O que ainda permanece local nesta etapa

- pacientes;
- tutores/clientes;
- procedimentos e valores;
- relatórios operacionais;
- auditoria;
- numeração.

Esses módulos serão migrados depois da validação do login no Neon.

## Configuração

1. No Neon, abra seu projeto.
2. Clique em Connect e copie a conexão PostgreSQL (preferencialmente Pooled).
3. Na raiz do projeto crie `.env.local`:

DATABASE_URL="postgresql://..."
ADMIN_USER="admin"
ADMIN_PASSWORD="SUA_SENHA_FORTE"
ADMIN_NAME="Administrador Delta Vet"

4. Instale as dependências:

npm install

5. Crie as tabelas e o usuário administrador:

npm run db:init

6. Abra:

npm run dev

## Login

O usuário inicial será o valor definido em `ADMIN_USER`.
A senha inicial será o valor definido em `ADMIN_PASSWORD`.

Depois, entre no CMS e cadastre os demais usuários em:

Painel CMS → Cadastros → Funcionários / Acessos

## Vercel

Adicione também no projeto da Vercel:

DATABASE_URL

Depois faça novo deploy.

`ADMIN_USER` e `ADMIN_PASSWORD` são necessários para o `npm run db:init`,
não precisam ficar na Vercel depois que o admin já foi criado.

## Segurança

- senha com scrypt + salt;
- sessão aleatória salva no banco;
- cookie HTTP-only;
- usuários inativos perdem o acesso;
- troca de senha encerra as sessões do usuário;
- permissões são verificadas também nas APIs administrativas.

Versão: 1.16.0
