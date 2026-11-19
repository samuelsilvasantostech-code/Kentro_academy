# Kentro Academy

Área de membros onde os clientes da Kentro aprendem a usar o sistema de atendimento. São 6 trilhas por papel (Atendente, Gestão da operação, Implantação, Vendas com CRM, Automação (URA) e Integrações e API), com progresso por aula, quiz por módulo, certificado, dúvidas respondidas pela equipe e um painel `/admin` para a equipe publicar conteúdo sem mexer em código. Os vídeos continuam no YouTube.

Para a equipe Kentro que opera o painel, veja `../docs/guia-do-admin.md`. As decisões de arquitetura estão em `../docs/adr/0001-reestruturacao-kentro-academy.md`.

## Stack

- Next.js 16.4.6 (App Router, Turbopack) e React 19.3. No Next 16 o Middleware se chama Proxy (`src/proxy.ts`), e `params` e `searchParams` são Promise. Antes de escrever código, leia o guia certo em `node_modules/next/dist/docs/` (veja `AGENTS.md`).
- Supabase (Postgres, Auth, RLS) com `@supabase/ssr`. Projeto na região sa-east-1 (São Paulo).
- Deploy na Vercel.
- Vídeos incorporados por `youtube-nocookie.com`.

## Pré-requisitos

- Node.js 20.9 ou mais novo (mínimo exigido pelo Next 16; testado com Node 24).
- npm.
- Acesso ao projeto Supabase da Kentro Academy.

## Rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env.local` na pasta `app/` (veja a próxima seção).
3. Suba o servidor de desenvolvimento e abra http://localhost:3000:

```bash
npm run dev
```

## Variáveis de ambiente

| Variável | O que é |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave *publishable* (pública) do Supabase |
| `NEXT_PUBLIC_SITE_URL` | Opcional. Origem pública do site, sem barra final (ex.: `https://academy.kentro.com.br`). Quando definida, os links de confirmação e de redefinição de senha usam ela; senão, usam os headers do pedido. Defina em produção. |
| `CSP_ENFORCE` | Opcional. `1` faz a política CSP bloquear (`Content-Security-Policy`); sem ela, só reporta (`Content-Security-Policy-Report-Only`). |

Exemplo de `.env.local` (troque os placeholders pelos valores do painel do Supabase, em Project Settings, API):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref-do-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave-publishable>
```

Regras:

- `.env.local` está no `.gitignore`. Nunca faça commit dele nem cole os valores em chat, URL ou issue.
- **Nunca use a chave `service_role` no app.** Todo acesso passa pelo RLS com a chave publishable.

## Banco de dados

As migrations ficam em `supabase/migrations/` e devem ser aplicadas **em ordem**:

| Arquivo | Conteúdo |
| --- | --- |
| `0001_schema.sql` | Tabelas, RLS, `is_admin()`, gatilho `handle_new_user`, `submit_quiz`, `admin_quiz_questions` |
| `0002_ajustes_advisors.sql` | Ajustes apontados pelos advisors do Supabase (permissões e índices) |
| `0003_admin.sql` | `lessons.published`, `answer_seen_at`, RPCs `admin_*`, `mark_answers_seen`, `track_completion`, índices e constraints |
| `0004_seguranca.sql` | Correções da revisão de segurança (RPCs `admin_*` como *invoker*, `submit_quiz` revisada, privilégios) |
| `0005_certificados.sql` | Certificado permanente (`track_certificates`), `anon` sem grants, vínculos de trilha rascunho ocultos |
| `0006_endurecimento.sql` | `submit_quiz` valida respostas e limita a 1 tentativa a cada 20 s, `handle_new_user` trunca em 120, default privileges sem execute para `public`/`anon` |

As seis já estão aplicadas no projeto de produção. Para um projeto novo:

1. Abra o SQL Editor do Supabase (ou use o MCP do Supabase, com `apply_migration`).
2. Cole e execute cada arquivo, na ordem de 0001 a 0006.
3. Rode os advisors (security e performance) e confirme que não há alerta de segurança.

Os arquivos usam prefixo `0001_`, e não o carimbo de data do Supabase CLI. Por isso o fluxo documentado aqui é o SQL Editor ou o MCP; `supabase db push` não foi testado com esses nomes.

Regras para mudar o banco:

- Toda mudança de schema entra como **migration nova e numerada** (`0007_...sql`). Nunca edite uma migration já aplicada.
- Drop de tabela, coluna ou policy exige OK do dono do projeto.

### Seed (conteúdo inicial)

O seed cria 6 trilhas, 21 módulos e 72 aulas a partir do protótipo (`../prototipo/index.html`). Para regerar o arquivo:

```bash
node scripts/gerar-seed.mjs
```

Isso escreve `supabase/seed.sql`. Execute-o no SQL Editor **só em um banco com o catálogo vazio**: o arquivo só tem `insert` e falha (ou duplica dados) se o catálogo já existir. No projeto de produção ele já foi aplicado.

### Tornar alguém admin

Não há tela para isso, e o aluno não consegue se promover (a coluna `is_admin` não está entre as editáveis). O dono faz no SQL Editor do Supabase:

1. A pessoa cria a conta e confirma o e-mail pela tela de entrada.
2. No SQL Editor, rode, trocando o e-mail:

```sql
update public.profiles
   set is_admin = true
 where id = (select id from auth.users where email = 'pessoa@exemplo.com');
```

3. A pessoa recarrega a página: aparece o link "Admin" no menu da conta. Para remover o acesso, use `is_admin = false`.

## Testes, lint e build

```bash
npm test                                      # validação do /admin (node --test)
npm run lint                                  # ESLint
npx tsc --noEmit                              # checagem de tipos
npm run build                                 # build de produção
```

O lint hoje passa com 2 avisos (`<img>` em `page.tsx` e `cards.tsx`).

## Deploy na Vercel

1. Importe o projeto na Vercel com a pasta raiz `app/`.
2. Em Settings, Environment Variables, cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` em **Production** e **Preview**.
3. No Supabase, em Authentication, URL Configuration:
   - **Site URL**: `https://<domínio>` (domínio ainda não definido; sugestão `academy.kentro.com.br`).
   - **Redirect URLs**: somente `https://<domínio>/auth/confirmar` e, para desenvolvimento, `http://localhost:3000/auth/confirmar`. Sem curingas (`*`).
4. Templates de e-mail: o template padrão de recuperação de senha funciona. Se você personalizá-lo, o link deve ser:

```text
{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery
```

5. Faça o deploy e teste cadastro, confirmação por e-mail e "Esqueci a senha" no domínio final.

O Supabase usa o SMTP embutido, que tem limite baixo de envios por hora. SMTP próprio ainda não foi decidido (veja a ADR).

## Estrutura de pastas

```text
app/
  src/
    proxy.ts                  renova a sessão; manda para /entrar quem não entrou
    app/
      entrar/                 cadastro, login, sair e /entrar/esqueci
      redefinir-senha/        nova senha depois do link do e-mail
      auth/confirmar/         troca o link do e-mail por sessão
      (app)/                  área do aluno (início, trilhas, aula, quiz, buscar, meu, certificado, comecar)
      admin/                  painel da equipe (fora do grupo (app))
        _actions/             server actions: lessons, modules, news, questions, quizzes, tracks
        _components/          formulários e botões compartilhados
        trilhas/ aulas/ quizzes/ duvidas/ novidades/
    lib/
      supabase/server.ts      cliente Supabase do servidor
      catalog.ts              catálogo inteiro numa consulta (cache do React)
      admin/                  validate.ts (+ teste), require-admin.ts, queries.ts, form-state.ts, db-error.ts
    components/               cards e navegação
  supabase/
    migrations/               0001 a 0006
    seed.sql                  gerado por scripts/gerar-seed.mjs
  scripts/gerar-seed.mjs
```

## Segurança

- **RLS em todas as tabelas.** Só admin escreve no catálogo. O aluno lê apenas aulas e trilhas publicadas (policies restritivas de rascunho) e só os próprios dados (progresso, notas, tentativas, dúvidas).
- **Gabarito do quiz.** O aluno não consegue ler as colunas `correct` e `explanation` (privilégio de coluna revogado). A correção é feita no banco por `submit_quiz(p_module, p_answers)`, que grava a tentativa; a nota não pode ser forjada. Quem tira menos de 70% recebe só acertou/errou por pergunta; o gabarito e as explicações vão só a quem passa. O admin lê o gabarito por `admin_quiz_questions`.
- **Admin em duas barreiras.** O servidor confere `is_admin()` antes de renderizar (`getAdmin()` no layout do `/admin`, que responde 404 a quem não é admin) e antes de cada escrita (`requireAdmin()` nas server actions). O RLS é a segunda barreira.
- **Quem vira admin.** A coluna `is_admin` não é editável pelo aluno; só o dono, pelo SQL Editor.
- **Funções `SECURITY DEFINER`.** `is_admin`, `submit_quiz`, `admin_quiz_questions` e `mark_answers_seen` são exceções aceitas nos advisors; `handle_new_user` também é definer, mas só roda pelo gatilho. As demais funções `admin_*` e `track_completion` rodam como o chamador (*invoker*).
- **Sem service role no app.** Só existem a URL e a chave publishable.
- **Cookies e cabeçalhos.** Os cookies de sessão são `httpOnly` (o app não tem cliente Supabase de navegador). Cabeçalhos: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e CSP (só relatório até definir `CSP_ENFORCE=1`).
- **Freio do quiz.** `submit_quiz` aceita uma tentativa a cada 20 s por aluno e módulo e exige uma resposta por pergunta.
