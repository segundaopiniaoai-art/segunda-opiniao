# Runbook: Restructure Mastra source for Mastra Cloud Deploy

**Data:** 2026-04-27
**Contexto:** O `mastra server deploy` falhou com `Missing required file ... src/mastra/index.ts`. A CLI da Mastra exige o layout convencional `<root>/src/mastra/index.ts` + `package.json` + `tsconfig.json` próprios. Nossa estrutura atual é flat (`mastra/index.ts`). Este runbook reestrutura para o layout esperado e mantém a aplicação funcional.

**Ambiente alvo:** Windows + PowerShell, repositório em `C:\Users\Diego\Repositorios\segunda-opiniao`.

**Pré-requisitos:**
- `git` e `node` (com `npm`) instalados.
- `mastra` CLI já instalado globalmente (`npm install -g mastra`).
- Já autenticado em `projects.mastra.ai` na sua org.
- `mastra/.mastra-project.json` já existe (foi criado na tentativa anterior de deploy — NÃO apague).
- `mastra/.env` já existe com `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MASTRA_API_KEY` preenchidos.

> Todas as tasks são **idempotentes onde possível** e usam `git mv` para preservar histórico.

---

## Task 1: Pré-checagem do estado do repo

- [ ] Abrir PowerShell e ir para a raiz do projeto:

```powershell
cd C:\Users\Diego\Repositorios\segunda-opiniao
```

- [ ] Confirmar branch e estado limpo:

```powershell
git status
git branch --show-current
```

Esperado: `main` com working tree razoavelmente limpo. Se houver mudanças não commitadas que você quer manter, faça `git stash` antes.

- [ ] Confirmar que os 17 arquivos Mastra estão no layout flat atual:

```powershell
Get-ChildItem -Recurse mastra -File | Where-Object { $_.Name -like "*.ts" } | Select-Object FullName
```

Esperado ver:
```
mastra\index.ts
mastra\agents\index.ts
mastra\agents\shared.ts
mastra\agents\cardiology.ts
mastra\agents\oncology.ts
mastra\agents\neurology.ts
mastra\agents\orthopedics.ts
mastra\agents\dermatology.ts
mastra\agents\general-practice.ts
mastra\lib\mark-failed.ts
mastra\lib\supabase-admin.ts
mastra\schemas\consultation-result.ts
mastra\workflows\consultation-workflow.ts
mastra\workflows\steps\load-context.ts
mastra\workflows\steps\download-pdfs.ts
mastra\workflows\steps\run-specialist.ts
mastra\workflows\steps\persist-result.ts
```

(17 arquivos `.ts`.) E `mastra\.mastra-project.json` deve existir (mas não termina em `.ts`).

---

## Task 2: Mover os 17 arquivos para `mastra/src/mastra/`

> Usamos `git mv` para preservar histórico. As pastas intermediárias (`src/`, `src/mastra/`, etc.) o git cria automaticamente quando o destino tem subdiretórios.

- [ ] Criar a estrutura de pastas:

```powershell
New-Item -ItemType Directory -Force -Path mastra\src\mastra\agents | Out-Null
New-Item -ItemType Directory -Force -Path mastra\src\mastra\lib | Out-Null
New-Item -ItemType Directory -Force -Path mastra\src\mastra\schemas | Out-Null
New-Item -ItemType Directory -Force -Path mastra\src\mastra\workflows\steps | Out-Null
```

- [ ] Mover os arquivos:

```powershell
git mv mastra/index.ts mastra/src/mastra/index.ts

git mv mastra/agents/index.ts mastra/src/mastra/agents/index.ts
git mv mastra/agents/shared.ts mastra/src/mastra/agents/shared.ts
git mv mastra/agents/cardiology.ts mastra/src/mastra/agents/cardiology.ts
git mv mastra/agents/oncology.ts mastra/src/mastra/agents/oncology.ts
git mv mastra/agents/neurology.ts mastra/src/mastra/agents/neurology.ts
git mv mastra/agents/orthopedics.ts mastra/src/mastra/agents/orthopedics.ts
git mv mastra/agents/dermatology.ts mastra/src/mastra/agents/dermatology.ts
git mv mastra/agents/general-practice.ts mastra/src/mastra/agents/general-practice.ts

git mv mastra/lib/mark-failed.ts mastra/src/mastra/lib/mark-failed.ts
git mv mastra/lib/supabase-admin.ts mastra/src/mastra/lib/supabase-admin.ts

git mv mastra/schemas/consultation-result.ts mastra/src/mastra/schemas/consultation-result.ts

git mv mastra/workflows/consultation-workflow.ts mastra/src/mastra/workflows/consultation-workflow.ts
git mv mastra/workflows/steps/load-context.ts mastra/src/mastra/workflows/steps/load-context.ts
git mv mastra/workflows/steps/download-pdfs.ts mastra/src/mastra/workflows/steps/download-pdfs.ts
git mv mastra/workflows/steps/run-specialist.ts mastra/src/mastra/workflows/steps/run-specialist.ts
git mv mastra/workflows/steps/persist-result.ts mastra/src/mastra/workflows/steps/persist-result.ts
```

- [ ] Remover as pastas vazias antigas:

```powershell
Remove-Item -Force -Recurse mastra\agents -ErrorAction SilentlyContinue
Remove-Item -Force -Recurse mastra\lib -ErrorAction SilentlyContinue
Remove-Item -Force -Recurse mastra\schemas -ErrorAction SilentlyContinue
Remove-Item -Force -Recurse mastra\workflows -ErrorAction SilentlyContinue
```

(Se git já removeu, esses comandos não fazem nada.)

- [ ] Verificar:

```powershell
git status
Get-ChildItem -Recurse mastra\src -File
```

Os 17 `.ts` devem aparecer agora sob `mastra/src/mastra/...`.

> **Imports relativos dentro do Mastra:** todos usam paths como `'./shared'`, `'../../lib/supabase-admin'`, etc. Como TODOS os arquivos foram movidos juntos, os caminhos relativos entre eles permanecem corretos. Não precisa editar nada do conteúdo.

---

## Task 3: Criar `mastra/package.json`

- [ ] Criar o arquivo `mastra/package.json` com este conteúdo EXATO:

```json
{
  "name": "segunda-opiniao-mastra",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "mastra dev",
    "build": "mastra build",
    "deploy": "mastra server deploy"
  }
}
```

(Note: `dependencies` será adicionada na Task 6 quando rodar `npm install`.)

---

## Task 4: Criar `mastra/tsconfig.json`

- [ ] Criar o arquivo `mastra/tsconfig.json` com este conteúdo EXATO:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/mastra/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", ".mastra"]
}
```

---

## Task 5: Criar/atualizar `mastra/.gitignore`

- [ ] Criar `mastra/.gitignore` com:

```
node_modules/
.mastra/
.env
.env.local
*.log
```

> **Importante:** o `.env` da pasta `mastra/` é sensível — contém `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY`. NUNCA deve ser commitado.
> Já o `.mastra-project.json` (que linka esse projeto à plataforma) **deve permanecer versionado** — não inclua no `.gitignore`.

- [ ] Confirmar que `.env` não está rastreado:

```powershell
git ls-files mastra/.env
```

Esperado: saída vazia. Se aparecer algo, é porque foi commitado por engano:

```powershell
git rm --cached mastra/.env
```

---

## Task 6: Instalar dependências do Mastra

- [ ] Entrar na pasta `mastra/` e instalar as deps:

```powershell
cd C:\Users\Diego\Repositorios\segunda-opiniao\mastra
npm install @mastra/core @ai-sdk/anthropic @supabase/supabase-js zod
```

Isso adiciona `dependencies` ao `package.json` com as versões resolvidas, e cria `package-lock.json` + `node_modules/`.

- [ ] Voltar para a raiz:

```powershell
cd ..
```

---

## Task 7: Atualizar `tsconfig.json` da Next.js (path alias)

A Next.js importa tipos via `import type ... from '@/mastra/...'` (em `consultation-result.tsx`, `consultation-status-live.tsx`, etc.). Como o conteúdo agora vive em `mastra/src/mastra/`, precisamos de um path alias específico.

- [ ] Editar `C:\Users\Diego\Repositorios\segunda-opiniao\tsconfig.json`. Encontrar o bloco `paths`:

```json
"paths": {
  "@/*": ["./*"]
}
```

E SUBSTITUIR por:

```json
"paths": {
  "@/mastra/*": ["./mastra/src/mastra/*"],
  "@/*": ["./*"]
}
```

> A ordem importa: o TypeScript usa o **primeiro match**. `@/mastra/*` deve vir ANTES do `@/*` mais genérico.

---

## Task 8: Atualizar `jest.config.ts` (moduleNameMapper)

Os testes em `__tests__/mastra/` também usam `@/mastra/...`. Jest tem seu próprio resolvedor de paths.

- [ ] Editar `C:\Users\Diego\Repositorios\segunda-opiniao\jest.config.ts`. Encontrar o bloco `moduleNameMapper`:

```ts
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
},
```

E SUBSTITUIR por:

```ts
moduleNameMapper: {
  '^@/mastra/(.*)$': '<rootDir>/mastra/src/mastra/$1',
  '^@/(.*)$': '<rootDir>/$1',
},
```

> Mesma regra de ordem que no tsconfig.

---

## Task 9: Verificação rápida (sem executar a CLI ainda)

- [ ] Verificar que os imports da Next.js continuam apontando para arquivos existentes:

```powershell
cd C:\Users\Diego\Repositorios\segunda-opiniao
Get-ChildItem mastra\src\mastra\schemas\consultation-result.ts
Get-ChildItem mastra\src\mastra\agents\index.ts
Get-ChildItem mastra\src\mastra\workflows\steps\run-specialist.ts
```

Os três comandos devem listar os arquivos sem erro.

- [ ] (Opcional) Rodar TypeScript para confirmar que tudo resolve:

```powershell
npx tsc --noEmit
cd mastra
npx tsc --noEmit
cd ..
```

(Pode dar erro de tipo se as versões instaladas do `@mastra/core` mudaram a API — anote, mas siga.)

---

## Task 10: Commitar a restruturação

- [ ] Verificar tudo que mudou:

```powershell
git status
```

Esperado:
- Renames de 17 arquivos para `mastra/src/mastra/...`
- Novos: `mastra/package.json`, `mastra/package-lock.json`, `mastra/tsconfig.json`, `mastra/.gitignore`
- Modificados: `tsconfig.json`, `jest.config.ts`

- [ ] Stage e commit:

```powershell
git add mastra tsconfig.json jest.config.ts
git status
git commit -m "refactor: restructure Mastra to src/mastra/ layout for Mastra Cloud"
```

> NÃO faça `git add .` sem ver o status — pode pegar arquivos não relacionados (ex.: o `2026-04-21-project-structure.md` com churn de line-endings).

---

## Task 11: Re-rodar o deploy

- [ ] Voltar para `mastra/`:

```powershell
cd C:\Users\Diego\Repositorios\segunda-opiniao\mastra
```

- [ ] Confirmar que `.mastra-project.json` está lá (não apague):

```powershell
Get-Content .mastra-project.json
```

- [ ] Rodar o deploy:

```powershell
mastra server deploy --project SegundaOpiniao
```

Esperado: build bem-sucedido + URL de produção impressa no fim, algo como:

```
✔ Deployed to https://<project-slug>.mastra.cloud
```

**Anote essa URL — é o `MASTRA_URL`.**

---

## Task 12: Atualizar `.env.local` da Next.js

Voltar para a raiz e configurar as envs que a Next.js precisa para chamar o Mastra:

- [ ] Editar (ou criar) `C:\Users\Diego\Repositorios\segunda-opiniao\.env.local`:

```
MASTRA_URL=https://<project-slug>.mastra.cloud
MASTRA_API_KEY=<o-mesmo-valor-que-você-pôs-em-mastra/.env>
```

> Se você ainda não tem o `MASTRA_API_KEY`, gere um:
> ```powershell
> [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
> ```
> E **garanta que o mesmo valor está em `mastra/.env`** — eles têm que bater.

- [ ] Confirmar que `.env.local` está no `.gitignore` (deve estar; padrão Next.js).

---

## Task 13: Smoke test do bearer auth

- [ ] Sem bearer (deve retornar 401):

```powershell
curl.exe -i -X POST https://<project-slug>.mastra.cloud/api/workflows/consultationWorkflow/start-async
```

- [ ] Com bearer (deve retornar algo que **NÃO** é 401 — provavelmente 4xx do schema porque o consultationId é fake):

```powershell
$env:MASTRA_API_KEY = "<seu-valor>"
curl.exe -i -X POST https://<project-slug>.mastra.cloud/api/workflows/consultationWorkflow/start-async `
  -H "Authorization: Bearer $env:MASTRA_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{\"inputData\":{\"consultationId\":\"00000000-0000-0000-0000-000000000000\"}}'
```

> O segundo provavelmente vai falhar com algo tipo "Consulta não encontrada" — isso é OK, significa que o middleware passou e o workflow rodou (e falhou no primeiro step `loadContext`). Se você ver `401 Unauthorized` no segundo, o `MASTRA_API_KEY` não bate entre Mastra Cloud e Next.js.

---

## Riscos conhecidos durante o build

- **`@mastra/core` API mudou:** se o build falhar com erros TypeScript em `Agent.generate(messages, { output })` ou similar, é o item C1 do code review final. Confirme a assinatura olhando `mastra/node_modules/@mastra/core/dist/agent/*.d.ts` ou na release notes da versão instalada. Se a chave correta for `experimental_output`, ajuste **dois lugares**:
  1. `mastra/src/mastra/workflows/steps/run-specialist.ts` (a chamada de `agent.generate`)
  2. `__tests__/mastra/workflows/steps/run-specialist.test.ts` (a assertion do mock)

- **`createWorkflow` API:** se a `.then(...).then(...).commit()` não compilar, idem — verificar API atual.

- **Snapshots de agente:** primeiro `npx jest` cria os 6 `.snap` em `__tests__/mastra/agents/__snapshots__/`. Comite-os depois.

---

## Resumo: o que mudou

| Antes | Depois |
|---|---|
| `mastra/index.ts` | `mastra/src/mastra/index.ts` |
| `mastra/{agents,lib,schemas,workflows}/...` | `mastra/src/mastra/{agents,lib,schemas,workflows}/...` |
| (sem) `mastra/package.json` | criado, com deps Mastra |
| (sem) `mastra/tsconfig.json` | criado, layout `src/mastra` |
| (sem) `mastra/.gitignore` | criado |
| `tsconfig.json` (root) `paths` | adicionado alias `@/mastra/*` |
| `jest.config.ts` `moduleNameMapper` | adicionado mapping para `@/mastra/*` |

Todos os 17 arquivos Mastra mantêm seu **conteúdo idêntico** — só mudaram de pasta. Os imports relativos entre eles continuam válidos. Os imports da Next.js (`@/mastra/...`) também continuam válidos graças aos novos aliases.
