# Dashboard & Consultation UX Redesign — Design Spec

**Date:** 2026-04-27
**Approach:** Redesign Coeso — reestruturar layout + componentes de feedback mantendo logica de negocio

## Overview

Redesign das paginas protegidas (dashboard, nova consulta, detalhe de consulta) para:
1. Alinhar visualmente com a landing page (tipografia, cores, espacamento)
2. Adicionar feedback rico nas transicoes de upload/processamento
3. Melhorar hierarquia visual e expressividade dos componentes

A landing page define a linguagem visual de referencia: Figtree/Noto Sans, paleta sky-blue/cyan, cards com `rounded-lg border border-border`, backgrounds alternados `bg-surface`/`bg-background`, espacamento generoso (`px-6 md:px-8`, `py-8`).

### Design token necessario

Adicionar em `globals.css`:
```css
--color-muted: #F1F5F9; /* slate-100 — fundo de badges neutros e estados inativos */
```

---

## Secao 1: Layout Protegido — Sidebar Colapsavel + Bottom Nav

### Desktop (>= 1024px)

- **Sidebar esquerda colapsavel**: expandida `w-56`, colapsada `w-16`
- **Toggle**: botao no topo com icone `PanelLeftClose` / `PanelLeftOpen`, atributo `aria-expanded` refletindo estado
- **Visual**: `bg-surface border-r border-border`
- **Logo**: versao completa ("Segunda Opiniao") quando expandida, so icone quando colapsada
- **Itens de navegacao**: icone + texto com `font-heading`, cor `text-muted-foreground` default, `text-primary` com `bg-primary/5` quando ativo. Atributo `aria-current="page"` no item ativo
- **Logout**: botao no rodape da sidebar
- **Area principal**: `bg-background` (#F8FAFC), conteudo com `max-w-4xl mx-auto px-6 md:px-8 py-8` (mais estreito que a landing page intencionalmente — conteudo de dashboard e leitura funciona melhor em largura contida)
- **Sidebar container**: `role="navigation" aria-label="Menu principal"`

### Mobile (< 1024px)

- **Sem sidebar**
- **MobileHeader**: `h-14 bg-surface border-b border-border sticky top-0 z-40`, logo "Segunda Opiniao" a esquerda (texto completo), botao de logout a direita (icone `LogOut`). Sem dropdown/menu — a navegacao principal fica no bottom nav
- **Bottom navigation fixa**: `h-16 bg-surface border-t border-border fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]`
  - 2 itens: "Consultas" (`ClipboardList`) e "Nova Consulta" (`Plus`)
  - Label pequena (`text-xs`) abaixo do icone
  - Ativo: `text-primary`, inativo: `text-muted-foreground`
  - `role="navigation" aria-label="Navegacao principal"`
- **Padding da area de conteudo**: `pb-20` para compensar o bottom nav fixo (16 = h-16 do nav + margem)

**Nota sobre tablet (768px-1023px):** usa o layout mobile (bottom nav + header). O breakpoint `lg` (1024px) foi escolhido porque a sidebar de `w-56` precisa de espaco horizontal suficiente para nao comprimir o conteudo.

### Transicao sidebar

- Animacao em duas fases:
  1. Labels fazem `opacity-0` com `transition-opacity duration-150`
  2. Apos 150ms, largura anima de `w-56` para `w-16` com `transition-[width] duration-200`
- Na expansao: largura primeiro, depois labels fazem `opacity-100`
- Labels usam `overflow-hidden whitespace-nowrap` para evitar wrap durante transicao
- Estado persistido em `localStorage` com chave `sidebar-collapsed`

---

## Secao 2: Dashboard — Cards de Consulta Melhorados

### Header da pagina

- Titulo "Minhas Consultas" com `font-heading text-2xl md:text-3xl font-bold`
- Botao "Nova Consulta" alinhado a direita, variante `default` do Button

**Nota**: o arquivo `app/(protected)/dashboard/page.tsx` precisa ser atualizado para incluir `font-heading` no titulo (atualmente usa apenas `text-2xl font-bold`).

### Cards de consulta

- **Grid**: `grid-cols-1 md:grid-cols-2 gap-4`
- **Card**: `bg-surface rounded-lg border border-border p-5`
- **Hover**: `hover:border-primary/30 hover:shadow-md transition-all duration-200`
- **Todos os cards sao links para `/consultas/[id]`** independente do status (mesmo comportamento atual)

### Conteudo do card

- **Topo**: icone do especialista `w-10 h-10` em circulo `bg-primary/10 text-primary`
- **Meio**: nome do especialista em `font-heading font-semibold text-base` (truncado com `truncate` se exceder largura do card), data em `text-sm text-muted-foreground` formato `dd/MM/yyyy`
- **Rodape**: badge de status alinhado a direita

### Badges de status

| Status | Fundo | Texto | Icone | Extra |
|---|---|---|---|---|
| `pending` | `bg-muted/50` | `text-muted-foreground` | `Clock` | — |
| `processing` | `bg-primary/10` | `text-primary` | `Loader2 animate-spin` | Card com `animate-pulse` sutil no border `border-primary/20` |
| `completed` | `bg-success/10` | `text-success` | `CheckCircle` | — |
| `failed` | `bg-destructive/10` | `text-destructive` | `AlertTriangle` | — |

(`bg-muted` usa o novo token `--color-muted: #F1F5F9`)

### Estado vazio

- Icone `ClipboardPlus` com `text-primary/30 w-16 h-16`
- Texto com `font-heading text-xl`, descricao em `text-muted-foreground`
- CTA button para nova consulta

---

## Secao 3: Formulario de Nova Consulta — Stepper Visual + Scroll

### Stepper visual no topo

- Barra horizontal com 3 passos: "Exames" > "Contexto" > "Especialista"
- Cada passo: numero em circulo `w-8 h-8 rounded-full` + label
- Acessibilidade: container com `role="navigation" aria-label="Progresso do formulario"`, cada passo com `aria-current="step"` quando ativo

#### Estados dos passos

| Estado | Circulo | Label |
|---|---|---|
| Completo | `bg-primary text-white` + icone `Check` | `text-foreground font-medium` |
| Atual | `border-2 border-primary text-primary` + numero | `text-primary font-semibold` |
| Futuro | `border border-border text-muted-foreground` + numero | `text-muted-foreground` |

- **Linhas conectoras**: `h-0.5`, `bg-primary` se completo, `bg-border` se futuro
- **Mobile**: labels escondidos (`sr-only`), so circulos + linhas

#### Estado "Enviando" do stepper (durante upload)

Quando o formulario esta em processo de envio (Secao 4):
- Todos os 3 passos ficam com estado "Completo"
- Um indicador adicional aparece apos o passo 3: icone `Loader2 animate-spin text-primary` com label "Enviando" (ou `sr-only` em mobile)

### Logica de progresso

- Passo 1 completo: pelo menos 1 PDF adicionado
- Passo 2 completo: sempre marcado como completo (campo e opcional — passo nao bloqueia progresso)
- Passo 3 completo: especialista selecionado
- Stepper e **apenas visual/informativo** — nao bloqueia navegacao

### Secoes do formulario

- Separadas por `py-6` com `border-t border-border`
- Titulo de secao: `font-heading text-lg font-semibold`
- Descricao: `text-sm text-muted-foreground`
- Clicar num passo do stepper: `scrollIntoView({ behavior: 'smooth' })`
- Cada secao tem um `ref` para o IntersectionObserver e para o scroll target

### Scroll tracking

- `IntersectionObserver` monitora qual secao esta visivel
- Stepper atualiza o passo "atual" conforme scroll
- Threshold: `0.5` (50% da secao visivel ativa o passo)
- `rootMargin: "-10% 0px"` para compensar headers fixos
- Se nenhuma secao atinge 50%, usa a primeira visivel (fallback)

### Botao de submit

- **Mobile**: fixo acima do bottom nav — `fixed bottom-16 inset-x-0 p-4 bg-surface border-t z-30` (bottom-16 = altura do BottomNav `h-16`)
- **Desktop**: inline no final do formulario
- Disabled ate ter arquivos + especialista selecionado
- **Padding do conteudo em mobile**: `pb-36` para compensar bottom nav (`h-16`) + submit fixo (`~h-16 com padding`)

---

## Secao 4: Feedback de Upload e Envio — Progress Inline

### Componente de progresso de upload

Exibido abaixo do formulario ao clicar submit:

- **Container**: `bg-surface rounded-lg border border-border p-6`
- **Titulo**: "Enviando seus exames..." com `font-heading font-semibold`
- Acessibilidade: `aria-live="polite"` no container para anunciar mudancas de status

### Lista de arquivos com progress bar individual

Cada arquivo exibe:
- Nome truncado (`min-w-0 truncate`, usa espaco disponivel no container) + tamanho formatado
- Progress bar: `h-1.5 rounded-full bg-border` com fill animado
- Progress bar acessivel: `role="progressbar" aria-valuemin="0" aria-valuemax="100"` com `aria-valuenow` atualizado

#### Estados por arquivo

| Estado | Progress bar | Icone | Texto |
|---|---|---|---|
| Aguardando | Vazia, `aria-valuenow="0"` | — | `text-muted-foreground` |
| Enviando | Fill com `w-2/3 bg-primary` animando com `transition-all duration-1000` (indeterminate simulado — fill cresce lentamente de 0% a 66% enquanto aguarda resposta) | `Upload text-primary` | — |
| Concluido | 100% `bg-success`, `aria-valuenow="100"` | `CheckCircle text-success` | fade-in 200ms |
| Erro | 100% `bg-destructive` | `XCircle text-destructive` | Mensagem de erro abaixo |

- Upload sequencial — cada arquivo inicia quando o anterior termina

### Apos todos os uploads

1. Titulo muda para "Exames enviados! Iniciando analise..." com `CheckCircle` verde
2. Pausa visual 800ms
3. Card faz fade-out (300ms), redireciona para `/consultas/[id]`

### Em caso de erro no upload de arquivo

- Arquivos com erro marcados em vermelho
- Arquivos ja enviados com sucesso mantêm `CheckCircle` verde
- Botao "Tentar novamente" aparece abaixo da lista
- Ao clicar retry:
  - Arquivos com sucesso permanecem intactos (nao re-envia)
  - Arquivos com erro voltam para estado "Aguardando" e depois "Enviando"
  - Reutiliza as signed URLs existentes (validas por alguns minutos)
  - Se uma signed URL expirou, o PUT retorna erro e o arquivo fica em estado de erro novamente — neste caso, mostrar mensagem "Erro: tente criar uma nova consulta" e botao para voltar ao formulario
- Nao redireciona — mantem usuario na mesma tela

### Em caso de erro no `confirmConsultationUpload`

Cenario: todos os arquivos enviados com sucesso (todos com `CheckCircle` verde), mas a confirmacao do server action falha.

- Titulo muda para "Erro ao iniciar analise" com `AlertTriangle text-destructive`
- Mensagem: "Seus exames foram enviados, mas houve um erro ao iniciar a analise. Tente novamente."
- Botao "Tentar novamente" chama `confirmConsultationUpload` novamente (sem re-upload)
- Se falhar 2x, mostrar mensagem "Erro persistente. Tente criar uma nova consulta." com botao para voltar

### Durante o processo

- Formulario desabilitado: `opacity-50 pointer-events-none`
- Stepper mostra estado "Enviando" (ver Secao 3)
- `beforeunload` event listener ativo — ao tentar sair da pagina, mostra dialogo nativo de confirmacao do navegador

---

## Secao 5: Pagina de Detalhe — Processamento e Animacao de Resultado

### Estado "Pendente" (`pending`)

Exibido quando o usuario acessa `/consultas/[id]` e o status ainda e `pending` (upload nao confirmado):

- Mesmo header e informacoes da consulta (arquivos, contexto)
- Card simples: `bg-muted/30 border border-border rounded-lg p-8 text-center`
  - Icone `Clock w-12 h-12 text-muted-foreground`
  - Texto: "Aguardando envio dos exames..." em `font-heading text-lg font-semibold text-muted-foreground`
  - Texto secundario: "O upload dos seus exames ainda nao foi concluido." em `text-sm text-muted-foreground`
- Supabase real-time ativo — quando status mudar para `processing`, transiciona para o card de processamento

### Estado "Processando" (`processing`)

- **Header**: "Consulta com [Especialista]" + badge `processing` com `animate-spin`
- Informacoes da consulta (arquivos, contexto) exibidas normalmente acima do card de processamento. **Estas informacoes permanecem visiveis em todos os estados** (processando, completo, falha).

- **Card de processamento**: `bg-primary/5 border border-primary/20 rounded-lg p-8 text-center`
  - Icone `Loader2 w-12 h-12 text-primary animate-spin`
  - Texto principal: "Analisando seus exames..." em `font-heading text-lg font-semibold`
  - Texto secundario: "Isso pode levar alguns minutos. Voce pode sair e voltar a qualquer momento — o resultado aparecera automaticamente." em `text-sm text-muted-foreground`

- **Indicador de etapas decorativo** (baseado em tempo, nao no progresso real):
  - 3 etapas verticais: "Lendo documentos" > "Analisando resultados" > "Preparando relatorio"
  - Completa: `CheckCircle text-success`
  - Atual: `Loader2 animate-spin text-primary`
  - Futura: `Circle text-muted-foreground/40`
  - Transicao entre etapas a cada 30s com fade de 300ms (`transition-opacity duration-300`)
  - Se o processamento completar antes das 3 etapas: a transicao para resultado interrompe o indicador imediatamente
  - Se o processamento exceder 90s: a terceira etapa permanece com spinner indefinidamente ate o resultado chegar
  - Acessibilidade: `aria-live="polite"` no container do indicador para anunciar mudanca de etapa

### Transicao processando > resultado (via Supabase real-time)

Quando status muda para `completed`:

- Acessibilidade: anuncio via `aria-live="assertive"`: "Resultado da consulta disponivel"

1. Card de processamento faz fade-out (300ms, `transition-opacity duration-300`)
2. Pausa (200ms)
3. **Secoes do resultado entram uma a uma** (stagger animation):
   - Cada secao renderizada condicionalmente (monta no DOM quando `showResult` state e true)
   - Cada secao recebe `style={{ animationDelay: '${index * 150}ms' }}`
   - Animacao via `@keyframes` definido em `globals.css`:
     ```css
     @keyframes fade-in-up {
       from { opacity: 0; transform: translateY(1rem); }
       to { opacity: 1; transform: translateY(0); }
     }
     ```
   - Classe aplicada: `animate-fade-in-up` com `animation-fill-mode: both` e `animation-duration: 500ms` e `animation-timing-function: ease-out`
   - Ordem: Resumo > Achados > Analise > Recomendacoes > Perguntas > Sinais de alerta > Confianca > Disclaimer
4. Secoes ficam visiveis permanentemente apos animar (`animation-fill-mode: both` garante isso)

### Transicao processando > falha

- Card de processamento transiciona para card de erro (300ms)
- Mesmo container, muda cor para `bg-destructive/5 border-destructive/20`
- Icone muda de spinner para `AlertTriangle text-destructive`
- Botao "Tentar novamente" com fade-in (200ms)
- Acessibilidade: anuncio via `aria-live="assertive"`: "Erro na analise da consulta"

---

## Componentes Novos Necessarios

| Componente | Descricao |
|---|---|
| `CollapsibleSidebar` | Sidebar colapsavel com toggle, persistencia localStorage, `role="navigation"`, `aria-expanded` |
| `BottomNav` | Navegacao fixa inferior para mobile, `h-16`, safe area insets, `role="navigation"` |
| `MobileHeader` | Header `h-14 sticky top-0`, logo + logout, `border-b` |
| `FormStepper` | Stepper visual horizontal com estados, scroll tracking via IntersectionObserver, estado "Enviando", `aria-current="step"` |
| `FileUploadProgress` | Progress bar por arquivo com estados animados, retry de arquivos falhados, `role="progressbar"`, `aria-live` |
| `ProcessingCard` | Card de processamento com etapas decorativas temporizadas (30s), `aria-live` |
| `AnimatedSection` | Wrapper que aplica `animate-fade-in-up` com `animationDelay` via style prop |
| `StatusBadge` | Badge de status redesenhado com icones e animacoes |

## Componentes / Paginas Existentes Modificados

| Componente | Mudancas |
|---|---|
| `app/(protected)/layout.tsx` | Novo layout com sidebar colapsavel (desktop) + mobile header + bottom nav (mobile) |
| `app/(protected)/dashboard/page.tsx` | Adicionar `font-heading` no titulo |
| `app/(protected)/consultas/nova/page.tsx` | Integrar refs de secao para o stepper |
| `components/dashboard/consultation-list.tsx` | Cards redesenhados com hover, icones maiores, badges novos |
| `components/consultation/consultation-form.tsx` | Integrar stepper, progress de upload, botao fixo mobile, `beforeunload` |
| `components/consultation/consultation-status-live.tsx` | Novo card de processamento com etapas decorativas, estado `pending`, `aria-live` |
| `components/consultation/consultation-result.tsx` | Animacao stagger secao por secao via `AnimatedSection` |
| `components/consultation/consultation-failed.tsx` | Transicao suave do card de processamento |
| `app/globals.css` | Adicionar `--color-muted`, `@keyframes fade-in-up`, utility `animate-fade-in-up` |

## Consideracoes Tecnicas

- **Animacoes**: CSS puro via Tailwind (`transition-*`) + um `@keyframes fade-in-up` custom em `globals.css` para o stagger de resultado. Sem biblioteca de animacao externa
- **Stagger**: implementado via `animation-delay` inline no `style` prop de cada secao, usando o keyframe custom. `animation-fill-mode: both` garante que a secao fica invisivel antes do delay e visivel apos animar
- **IntersectionObserver**: para scroll tracking do stepper. Threshold `0.5`, `rootMargin: "-10% 0px"`. Fallback para primeira secao visivel se nenhuma atingir 50%
- **localStorage**: chave `sidebar-collapsed` para persistir estado da sidebar
- **Responsividade**: breakpoint `lg` (1024px) para alternar sidebar/bottom-nav. Tablet (768-1023px) usa layout mobile intencionalmente
- **Safe area insets**: BottomNav usa `pb-[env(safe-area-inset-bottom)]` para dispositivos com home indicator (iOS)
- **Acessibilidade**:
  - `prefers-reduced-motion` respeitado — desabilita animacoes quando ativo, mantendo transicoes de estado sem movimento
  - `aria-live` regions para mudancas de status em tempo real
  - `role="navigation"` e `aria-label` em sidebar, bottom nav, stepper
  - `aria-expanded` no toggle da sidebar
  - `aria-current="step"` no stepper, `aria-current="page"` na navegacao
  - `role="progressbar"` com `aria-valuenow` nas progress bars de upload
- **Performance**: animacoes usam `transform` e `opacity` (GPU-accelerated), evitando layout thrashing
- **Navegacao**: `beforeunload` listener durante upload para prevenir saida acidental
