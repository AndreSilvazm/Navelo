# Navelo

Plataforma de gestão de colaboradores PJ: a empresa convida os profissionais, acompanha cadastro, documentos, contratos e notas fiscais, e cada colaborador tem o seu portal.

- **Portal da empresa** (`/app`): colaboradores, contratos, notas fiscais, configurações e equipe.
- **Portal do colaborador** (`/portal`): primeiro acesso, contrato, notas fiscais, documentos e perfil.
- Acesso **somente por convite**. Uma pessoa pode ter mais de um acesso (várias empresas, ou colaborador e agente na mesma empresa).

## Stack

Next.js (App Router) · React 19 · Tailwind 4 · Drizzle ORM + PostgreSQL (Supabase) · TanStack Query · GSAP · Resend (e-mails).

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha os valores (veja abaixo)
npm run db:migrate           # aplica as migrações
npm run seed:dev             # (opcional) dados de desenvolvimento
npm run dev                  # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `APP_URL` | Endereço público do site (links de convite e metadados) |
| `RESEND_API_KEY` | Chave do Resend, para enviar e-mails de convite |
| `EMAIL_FROM` | Remetente dos e-mails |

Nunca versione o `.env.local`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Servidor de desenvolvimento, build e produção |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:studio` | Migrações e painel do banco (Drizzle) |
| `npm run company:create` | Cria uma empresa e o seu proprietário |
| `npm run seed:dev` | Popula dados de desenvolvimento |

## Documentos legais

Os textos de `/termos` e `/privacidade` ficam em `src/app/(legal)`; os dados da empresa e a versão vigente em `src/lib/legal.ts`. Ao alterar os textos, atualize a versão: o aceite de cada pessoa é registrado com ela.
