# Dashboard & Consultation UX Redesign — Design Spec

**Date:** 2026-04-27
**Approach:** Redesign Coeso — reestruturar layout + componentes de feedback mantendo logica de negocio

## Overview

Redesign das paginas protegidas (dashboard, nova consulta, detalhe de consulta) para:
1. Alinhar visualmente com a landing page (tipografia, cores, espacamento)
2. Adicionar feedback rico nas transicoes de upload/processamento
3. Melhorar hierarquia visual e expressividade dos componentes

A landing page define a linguagem visual de referencia: Figtree/Noto Sans, paleta sky-blue/cyan, cards com `rounded-lg border border-border`, backgrounds alternados `bg-surface`/`bg-background`, espacamento generoso (`px-6 md:px-8`, `py-8`).

---

## Secao 1: Layout Protegido — Sidebar Colapsavel + Bottom Nav

### Desktop (>= 1024px)

- **Sidebar esquerda colapsavel**: expandida `w-56`, colapsada `w-16`
- **Toggle**: botao no topo com icone `PanelLeftClose` / `PanelLeftOpen`
- **Visual**: `bg-surface border-r border-border`
- **Logo**: versao completa quando expandida, so icone quando colapsada
- **Itens de navegacao**: icone + texto com `font-heading`, cor `text-muted-foreground` default, `text-primary` com `bg-primary/5` quando ativo
- **Logout**: botao no rodape da sidebar
- **Area principal**: `bg-background` (#F8FAFC), conteudo com `max-w-4xl mx-auto px-6 md:px-8 py-8`

### Mobile (< 1024px)

- **Sem sidebar** — header superior fino com logo a esquerda e avatar/menu a direita
- **Bottom navigation fixa**: 2 itens — "Consultas" (`ClipboardList`) e "Nova Consulta" (`Plus`)
- **Bottom nav**: `bg-surface border-t border-border`, itens com label pequena abaixo do icone
- **Ativo**: `text-primary`, inativo: `text-muted-foreground`

### Transicao sidebar

- Animacao suave de largura: `transition-all duration-300`
- Labels com `transition-opacity` (fade-out/fade-in)
- Estado persistido em `localStorage`

---

## Secao 2: Dashboard — Cards de Consulta Melhorados

### Header da pagina

- Titulo "Minhas Consultas" com `font-heading text-2xl md:text-3xl font-bold`
- Botao "Nova Consulta" alinhado a direita, variante `default` do Button

### Cards de consulta

- **Grid**: `grid-cols-1 md:grid-cols-2 gap-4`
- **Card**: `bg-surface rounded-lg border border-border p-5`
- **Hover**: `hover:border-primary/30 hover:shadow-md transition-all duration-200`

### Conteudo do card

- **Topo**: icone do especialista `w-10 h-10` em circulo `bg-primary/10 text-primary`
- **Meio**: nome do especialista em `font-heading font-semibold text-base`, data em `text-sm text-muted-foreground`
- **Rodape**: badge de status alinhado a direita

### Badges de status

| Status | Fundo | Texto | Icone | Extra |
|---|---|---|---|---|
| `pending` | `bg-muted/50` | `text-muted-foreground` | `Clock` | — |
| `processing` | `bg-primary/10` | `text-primary` | `Loader2 animate-spin` | Card com `animate-pulse` sutil no border `border-primary/20` |
| `completed` | `bg-success/10` | `text-success` | `CheckCircle` | — |
| `failed` | `bg-destructive/10` | `text-destructive` | `AlertTriangle` | — |

### Estado vazio

- Icone `ClipboardPlus` com `text-primary/30 w-16 h-16`
- Texto com `font-heading text-xl`, descricao em `text-muted-foreground`
- CTA button para nova consulta

---

## Secao 3: Formulario de Nova Consulta — Stepper Visual + Scroll

### Stepper visual no topo

- Barra horizontal com 3 passos: "Exames" > "Contexto" > "Especialista"
- Cada passo: numero em circulo `w-8 h-8 rounded-full` + label

#### Estados dos passos

| Estado | Circulo | Label |
|---|---|---|
| Completo | `bg-primary text-white` + icone `Check` | `text-foreground font-medium` |
| Atual | `border-2 border-primary text-primary` + numero | `text-primary font-semibold` |
| Futuro | `border border-border text-muted-foreground` + numero | `text-muted-foreground` |

- **Linhas conectoras**: `h-0.5`, `bg-primary` se completo, `bg-border` se futuro
- **Mobile**: labels escondidos, so circulos + linhas

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

### Scroll tracking

- `IntersectionObserver` monitora qual secao esta visivel
- Stepper atualiza o passo "atual" conforme scroll
- Threshold ~50% de visibilidade

### Botao de submit

- **Mobile**: fixo acima do bottom nav `fixed bottom-[4rem] inset-x-0 p-4 bg-surface border-t` — coordenado com a altura do `BottomNav` para evitar sobreposicao
- **Desktop**: inline no final do formulario
- Disabled ate ter arquivos + especialista selecionado

---

## Secao 4: Feedback de Upload e Envio — Progress Inline

### Componente de progresso de upload

Exibido abaixo do formulario ao clicar submit:

- **Container**: `bg-surface rounded-lg border border-border p-6`
- **Titulo**: "Enviando seus exames..." com `font-heading font-semibold`

### Lista de arquivos com progress bar individual

Cada arquivo exibe:
- Nome truncado + tamanho formatado
- Progress bar: `h-1.5 rounded-full bg-border` com fill animado

#### Estados por arquivo

| Estado | Progress bar | Icone | Texto |
|---|---|---|---|
| Aguardando | Vazia | — | `text-muted-foreground` |
| Enviando | `animate-pulse bg-primary` (indeterminate) | `Upload text-primary` | — |
| Concluido | 100% `bg-success` | `CheckCircle text-success` | fade-in |
| Erro | `bg-destructive` | `XCircle text-destructive` | Mensagem de erro abaixo |

- Upload sequencial — cada arquivo inicia quando o anterior termina

### Apos todos os uploads

1. Titulo muda para "Exames enviados! Iniciando analise..." com `CheckCircle` verde
2. Pausa visual ~800ms
3. Card faz `fade-out`, redireciona para `/consultas/[id]`

### Em caso de erro

- Arquivos com erro marcados em vermelho
- Botao "Tentar novamente" re-envia apenas arquivos que falharam
- Nao redireciona — mantem usuario na mesma tela

### Durante o processo

- Formulario desabilitado: `opacity-50 pointer-events-none`
- Stepper mostra todos os passos completos + indicador de "enviando"

---

## Secao 5: Pagina de Detalhe — Processamento e Animacao de Resultado

### Estado "Processando"

- **Header**: "Consulta com [Especialista]" + badge `processing` com `animate-spin`
- Informacoes da consulta (arquivos, contexto) exibidas normalmente

- **Card de processamento**: `bg-primary/5 border border-primary/20 rounded-lg p-8 text-center`
  - Icone `Loader2 w-12 h-12 text-primary animate-spin`
  - Texto principal: "Analisando seus exames..." em `font-heading text-lg font-semibold`
  - Texto secundario: "Isso pode levar alguns minutos. Voce pode sair e voltar a qualquer momento — o resultado aparecera automaticamente." em `text-sm text-muted-foreground`

- **Indicador de etapas decorativo** (baseado em tempo, nao no progresso real):
  - 3 etapas verticais: "Lendo documentos" > "Analisando resultados" > "Preparando relatorio"
  - Completa: `CheckCircle text-success`
  - Atual: `Loader2 animate-spin text-primary`
  - Futura: `Circle text-border`
  - Transicao entre etapas a cada ~30s com fade suave

### Transicao processando > resultado (via Supabase real-time)

Quando status muda para `completed`:

1. Card de processamento faz `fade-out` (300ms)
2. Pausa (200ms)
3. **Secoes do resultado entram uma a uma** (stagger animation):
   - Cada secao: `opacity-0 translate-y-4` > `opacity-100 translate-y-0`
   - Duracao: `500ms ease-out` por secao
   - Delay entre secoes: `150ms`
   - Ordem: Resumo > Achados > Analise > Recomendacoes > Perguntas > Sinais de alerta > Confianca > Disclaimer
4. Secoes ficam visiveis permanentemente apos animar

### Transicao processando > falha

- Card de processamento transiciona para card de erro
- Mesmo container, muda cor para `bg-destructive/5 border-destructive/20`
- Icone muda de spinner para `AlertTriangle text-destructive`
- Botao "Tentar novamente" com `fade-in`

---

## Componentes Novos Necessarios

| Componente | Descricao |
|---|---|
| `CollapsibleSidebar` | Sidebar colapsavel com toggle, persistencia localStorage |
| `BottomNav` | Navegacao fixa inferior para mobile |
| `MobileHeader` | Header simplificado para mobile com logo e menu |
| `FormStepper` | Stepper visual horizontal com estados e scroll tracking |
| `FileUploadProgress` | Progress bar por arquivo com estados animados |
| `ProcessingCard` | Card de processamento com etapas decorativas |
| `AnimatedSection` | Wrapper para fade-in + slide-up com stagger |
| `StatusBadge` | Badge de status redesenhado com icones e animacoes |

## Componentes Existentes Modificados

| Componente | Mudancas |
|---|---|
| `app/(protected)/layout.tsx` | Novo layout com sidebar colapsavel + bottom nav |
| `components/dashboard/consultation-list.tsx` | Cards redesenhados com hover, icones maiores, badges novos |
| `components/consultation/consultation-form.tsx` | Integrar stepper, progress de upload, botao fixo mobile |
| `components/consultation/consultation-status-live.tsx` | Novo card de processamento com etapas decorativas |
| `components/consultation/consultation-result.tsx` | Animacao stagger seção por secao |
| `components/consultation/consultation-failed.tsx` | Transicao suave do card de processamento |

## Consideracoes Tecnicas

- **Animacoes**: CSS puro via Tailwind (`transition-*`, `animate-*`), sem biblioteca de animacao externa
- **IntersectionObserver**: para scroll tracking do stepper e possivelmente para trigger de animacoes de entrada
- **localStorage**: para persistir estado da sidebar colapsada
- **Responsividade**: breakpoint `lg` (1024px) para alternar sidebar/bottom-nav
- **Acessibilidade**: `prefers-reduced-motion` respeitado — desabilita animacoes quando ativo, mantendo transicoes de estado sem movimento
- **Performance**: animacoes usam `transform` e `opacity` (GPU-accelerated), evitando layout thrashing
