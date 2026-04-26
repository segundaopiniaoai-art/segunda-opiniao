# Landing Page — Segunda Opinião (Design Spec)

**Data:** 2026-04-26
**Branch atual:** `feature/project-structure`
**Status:** rascunho aprovado em brainstorming, aguardando revisão escrita do usuário antes de virar plan.

---

## 1. Contexto

### Produto
**Segunda Opinião** é uma aplicação web que utiliza IA para gerar uma segunda opinião médica baseada em exames do paciente, oferecendo análise probabilística fundamentada em literatura científica revisada por pares.

**Público:** pacientes brasileiros adultos que já realizaram exames e receberam (ou aguardam) um diagnóstico, e desejam validar ou aprofundar o entendimento sobre sua condição em um momento emocionalmente sensível.

**Tom de comunicação:** profissional, acolhedor, confiável, claro. Segurança médica sem soar frio nem excessivamente técnico.

### Restrições regulatórias e éticas (Brasil)
A landing page **deve** comunicar:
- Disclaimer ético-legal: "ferramenta de apoio à decisão; não substitui médico habilitado"
- Conformidade com a **LGPD** (Lei nº 13.709/2018)
- Alinhamento com orientações do **CFM** (Resolução nº 2.314/2022) e da **ANVISA** sobre uso de IA em saúde

A copy posiciona a Segunda Opinião como **ferramenta de apoio à decisão**, não como dispositivo médico autônomo.

### Escopo desta entrega
Substituir a landing placeholder atual (`app/(public)/page.tsx`, em inglês "AI Agent Platform") por uma landing completa em PT-BR, com seções: **Hero, Como Funciona, Benefícios, Confiabilidade, FAQ, CTA Final** e novo footer. Incluir páginas legais stub (`/privacidade`, `/termos`) e atualizar nav + metadata raiz.

### Fora de escopo
- Funcionalidade de upload de exames
- Dashboard, área autenticada, fluxos de IA
- Texto jurídico final de Privacidade/Termos (apenas stubs marcados como provisórios)
- Logo gráfico (apenas wordmark textual)
- Tracking, analytics, cookie banner
- i18n / múltiplos idiomas

---

## 2. Decisões tomadas no brainstorming

| Tema | Decisão |
|---|---|
| Mood visual | Clínico-sóbrio: branco dominante, azul-saúde, tipografia neutra |
| Biblioteca de UI | shadcn/ui (apenas `button` e `accordion` por enquanto) |
| Identidade | Proposta nova (logo wordmark, paleta, tipografia) |
| CTA principal | Leva para `/register` (auth já existente) |
| Conteúdo | Rascunhado neste spec, pronto para revisão |
| Imagens | Apenas ícones Lucide + tipografia (sem ilustrações nem fotos) |
| Páginas legais | Stubs `/privacidade` e `/termos` com banner "Versão preliminar" |
| Analytics | Nenhum nesta entrega |
| Idioma | PT-BR apenas |
| Acessibilidade | WCAG AA |
| Estrutura | Componentes por seção em `components/landing/` |

---

## 3. Arquitetura e estrutura de arquivos

### Mapa de mudanças

```
app/
  layout.tsx                        ← atualiza metadata raiz, lang="pt-BR", carrega next/font
  globals.css                       ← adiciona @theme com tokens (cores + fontes)
  (public)/
    layout.tsx                      ← passa a usar SiteHeader/SiteFooter; brand "Segunda Opinião"
    page.tsx                        ← reescreve para compor as seções da landing
    privacidade/
      page.tsx                      ← NOVO — stub LGPD provisório
    termos/
      page.tsx                      ← NOVO — stub provisório
components/
  ui/                               ← NOVO — shadcn primitivos
    button.tsx
    accordion.tsx
  layout/                           ← NOVO
    site-header.tsx
    site-footer.tsx
  landing/                          ← NOVO — uma seção por arquivo
    hero.tsx
    how-it-works.tsx
    benefits.tsx
    reliability.tsx
    faq.tsx
    final-cta.tsx
lib/
  cn.ts                             ← NOVO — helper clsx + tailwind-merge (exigido por shadcn)
public/
  og-image.png                      ← NOVO — 1200×630 estática
__tests__/
  landing/
    page.test.tsx                   ← NOVO — smoke tests
  legal/
    privacidade.test.tsx            ← NOVO
    termos.test.tsx                 ← NOVO
```

### Não tocar
`middleware.ts`, `lib/auth/*`, `lib/supabase/*`, `actions/*`, `app/(protected)/*`, `app/(admin)/*`, `components/auth/*`. O escopo é só público.

### Dependências novas
- `clsx`
- `tailwind-merge`
- `lucide-react`
- `@radix-ui/react-accordion` (entra como dependência transitiva ao instalar `accordion` via shadcn CLI)

### Restrição de implementação (importante)
O `AGENTS.md` deste projeto avisa que esta versão do Next.js tem mudanças de breaking. Antes de escrever código, o **plan deve validar contra `node_modules/next/dist/docs/`** as APIs de:
- `Metadata` / `metadataBase` (root layout)
- `next/font/google` (variáveis CSS, preload)
- OG image: arquivo estático em `public/` vs. `app/opengraph-image.tsx` route handler

O spec não decide a forma exata dessas APIs.

---

## 4. Identidade visual

### 4.1 Paleta (todos os pares ≥ 4.5:1 com texto contra fundo)

| Token | Hex | Uso |
|---|---|---|
| `--color-primary` | `#0284C7` | Azul saúde — CTA principal, links, destaques |
| `--color-primary-foreground` | `#FFFFFF` | Texto sobre primary |
| `--color-primary-hover` | `#0369A1` | Hover do CTA |
| `--color-secondary` | `#0891B2` | Apoio (cyan) — ícones, acentos |
| `--color-success` | `#16A34A` | Confirmação positiva (badge LGPD) |
| `--color-destructive` | `#DC2626` | Erros |
| `--color-background` | `#F8FAFC` | Fundo da página |
| `--color-surface` | `#FFFFFF` | Cards, accordion expanded |
| `--color-foreground` | `#0F172A` | Texto principal |
| `--color-muted-foreground` | `#475569` | Texto secundário |
| `--color-border` | `#E2E8F0` | Bordas e divisores |
| `--color-ring` | `#0284C7` | Focus ring |

**Verificação de contraste:**
- `primary` `#0284C7` sobre `#FFFFFF` = 4.66:1 ✓
- `foreground` `#0F172A` sobre `background` `#F8FAFC` = 17:1 ✓
- `muted-foreground` `#475569` sobre `#FFFFFF` = 7.5:1 ✓
- `primary-foreground` `#FFFFFF` sobre `primary` `#0284C7` = 4.66:1 ✓

**Anti-patterns proibidos:**
- ❌ Gradientes roxo/rosa "AI vibes" — fragilizam o tom médico
- ❌ Animações longas (>250ms) ou parallax
- ❌ Cores neon ou fluorescentes
- ❌ Emoji como ícone

### 4.2 Tipografia

| Papel | Fonte | Pesos | Carregamento |
|---|---|---|---|
| Display / heading | **Figtree** | 500, 600, 700 | `next/font/google`, `display: swap`, `preload: true` |
| Corpo / UI | **Noto Sans** | 400, 500, 700 | `next/font/google`, `display: swap`, `preload: false` |

Pareamento "Medical Clean" recomendado pela skill ui-ux-pro-max. Carregadas via `next/font` (zero CLS, sem `<link>` externo, sem requisições a googleapis.com).

**Escala (rem):** 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25 / 3.
**Body:** 1rem (16px), `line-height: 1.6`.
**Headings:** `line-height: 1.2`–`1.3`, `font-heading` (Figtree).

### 4.3 Logo wordmark

Texto "Segunda Opinião" em Figtree 700:
- "Segunda" em `--color-foreground`
- "Opinião" em `--color-primary`

Sem ícone gráfico nesta entrega. (Logo gráfico fica como item futuro fora de escopo.)

### 4.4 Iconografia

`lucide-react`, stroke 1.75px.
- Tamanho default: 24px
- Hero/Como funciona: 32px

Ícones planejados:
- Hero microcopy: `ShieldCheck`
- Como funciona: `UserPlus`, `FileUp`, `Sparkles`, `FileText`
- Benefícios: `BookOpen`, `Brain`, `Clock`, `Lock`
- Confiabilidade pilar 1 (Base científica): `Database`
- Confiabilidade pilar 2 (Privacidade): `ShieldCheck` (mesmo ícone do hero, reforça associação)
- Confiabilidade pilar 3 (Posicionamento ético): `Stethoscope`
- Confiabilidade callout LGPD/CFM: `Scale`
- FAQ: `ChevronDown` (Radix Accordion default)

### 4.5 Tokens em código (Tailwind v4)

`app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-primary: #0284C7;
  --color-primary-foreground: #FFFFFF;
  --color-primary-hover: #0369A1;
  --color-secondary: #0891B2;
  --color-success: #16A34A;
  --color-destructive: #DC2626;
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-foreground: #0F172A;
  --color-muted-foreground: #475569;
  --color-border: #E2E8F0;
  --color-ring: #0284C7;

  --font-heading: var(--font-figtree);
  --font-sans: var(--font-noto-sans);
}
```

Classes derivadas como `bg-primary`, `text-foreground`, `font-heading`, `ring-ring` ficam disponíveis automaticamente. shadcn/ui consome os mesmos tokens.

---

## 5. Conteúdo seção a seção

> Toda a copy desta seção está em PT-BR e foi rascunhada neste spec. O usuário pode revisar e ajustar antes do plan.

### 5.1 Disclaimer ético-legal — onde aparece
Três menções com pesos diferentes:
1. **Hero** — microcopy discreto sob o CTA, com ícone `ShieldCheck`
2. **Confiabilidade** — callout em destaque, em primeira pessoa
3. **Footer** — frase compacta na assinatura

(Não há banner fixo no topo: é fácil de ignorar e quebra hierarquia visual.)

### 5.2 Hero (`components/landing/hero.tsx`)

**Headline (h1):**
> Uma segunda opinião médica em minutos, baseada em evidências científicas.

**Subhead:**
> Envie seus exames e receba uma análise probabilística feita por uma IA especializada, fundamentada em milhares de artigos científicos. Para você decidir os próximos passos com mais segurança — junto com o seu médico.

**CTA primary:** `Comece agora` → `/register`
**CTA secundário (variant outline):** `Como funciona` → `#como-funciona`

**Microcopy abaixo dos CTAs (com ícone `ShieldCheck`):**
> Cadastro gratuito · Dados protegidos pela LGPD · Sua segunda opinião complementa, não substitui, seu médico.

### 5.3 Como funciona (`components/landing/how-it-works.tsx`)
**`id="como-funciona"`**
**Eyebrow:** Como funciona
**Headline (h2):** Quatro passos simples para mais clareza

| # | Ícone | Título | Descrição |
|---|---|---|---|
| 1 | `UserPlus` | Crie sua conta | Em menos de dois minutos, com o mínimo de informação. |
| 2 | `FileUp` | Envie seus exames | Laudos em PDF ou imagem. Tudo criptografado de ponta a ponta. |
| 3 | `Sparkles` | Análise por IA especialista | Um agente treinado em medicina cruza seus dados com milhares de estudos. |
| 4 | `FileText` | Receba o relatório | Hipóteses probabilísticas, justificadas, com referências à literatura. |

Layout: grid responsivo — 1 col mobile, 2 cols ≥640px, 4 cols ≥1024px. Numeração visível em cada cartão.

### 5.4 Benefícios (`components/landing/benefits.tsx`)
**`id="beneficios"`**
**Eyebrow:** Por que uma segunda opinião com IA
**Headline (h2):** Mais ciência, menos espera.

| Ícone | Título | Texto |
|---|---|---|
| `BookOpen` | Baseado em evidência científica | Cada hipótese é justificada com referências a artigos revisados por pares. Não é uma opinião — é o consenso da literatura aplicado ao seu caso. |
| `Brain` | IA especialista, não generalista | Treinada para análise médica. As respostas chegam estruturadas como um relatório clínico, não como uma conversa de chat. |
| `Clock` | Acessível e rápido | Sem agendamento, sem deslocamento. Em minutos, a qualquer hora. |
| `Lock` | Privacidade desde o design | Criptografia ponta a ponta. Seus dados nunca são usados para treinar modelos públicos. Em conformidade total com a LGPD. |

Layout: grid 1/2/4 colunas (mobile/tablet/desktop). Ícone + título + 1-2 linhas.

### 5.5 Confiabilidade (`components/landing/reliability.tsx`)
**`id="confiabilidade"`**
**Eyebrow:** Confiabilidade
**Headline (h2):** Confiabilidade não é opcional.
**Lead:** Uma segunda opinião sobre saúde precisa ser tão rigorosa quanto a primeira. Eis como construímos isso.

**Três pilares (cards):**

1. **Base científica viva** — Nossa IA consulta continuamente bases de artigos revisados por pares — incluindo PubMed, Cochrane, NEJM, The Lancet e JAMA. Cada conclusão do relatório cita as referências consultadas, para você (ou seu médico) verificar. *(Ícone: `Database`)*

2. **Privacidade e LGPD** — Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Sua equipe médica não tem acesso à sua conta. Você pode excluir todos os seus dados a qualquer momento, com efeito imediato. Sem venda, sem compartilhamento. *(Ícone: `ShieldCheck`)*

3. **Posicionamento ético** — A Segunda Opinião é uma ferramenta de apoio à decisão clínica. Não emitimos prescrições, atestados ou laudos oficiais. Toda conduta deve ser validada com um médico habilitado. *(Ícone: `Stethoscope`)*

**Callout abaixo dos cards** (faixa fina `bg-muted` com ícone `Scale`):
> Em conformidade com a LGPD (Lei nº 13.709/2018) e alinhada às orientações do CFM (Resolução nº 2.314/2022) e da ANVISA sobre uso de IA em saúde.

### 5.6 FAQ (`components/landing/faq.tsx`)
**`id="faq"`**
**Eyebrow:** Perguntas frequentes
**Headline (h2):** Tire suas dúvidas

Componente: shadcn `Accordion` (`type="single"`, `collapsible`). Default fechado. Único client component da landing (`'use client'`).

1. **A análise da IA é precisa?**
   A precisão depende da qualidade e completude dos exames enviados. Para casos bem documentados, nossos modelos atingem alta concordância com a literatura médica. Mesmo assim, sempre apresentamos as conclusões como probabilidades e hipóteses — nunca como diagnóstico fechado. Use o relatório como insumo da conversa com o seu médico.

2. **Quem tem acesso aos meus exames?**
   Apenas você. Arquivos são criptografados em trânsito (TLS 1.3) e em repouso (AES-256). Nossa equipe não acessa documentos individuais de pacientes. Você pode apagar todos os seus dados a qualquer momento, com efeito imediato.

3. **A Segunda Opinião substitui meu médico?**
   Não — e essa é uma escolha consciente. A ferramenta foi projetada para complementar a avaliação clínica, oferecendo uma leitura adicional fundamentada em literatura científica. Decisões sobre tratamento, medicação ou cirurgia devem ser tomadas com um médico habilitado.

4. **Que tipos de exame posso enviar?**
   Laudos em PDF, imagens (JPG, PNG) e exames de imagem em formato DICOM. Aceitamos hemograma, bioquímica, ultrassom, ressonância, tomografia, raio-X, biópsias e laudos especializados. Caso um formato não seja suportado, avisamos antes do upload.

5. **Quanto custa?**
   Você cria sua conta gratuitamente. As condições comerciais — planos, créditos ou pagamento por análise — são apresentadas dentro da plataforma após o cadastro, com total transparência antes de qualquer cobrança.

6. **A ferramenta segue as normas brasileiras?**
   Sim. Operamos em conformidade com a LGPD (Lei nº 13.709/2018) e seguimos as orientações do CFM (Resolução nº 2.314/2022 sobre telemedicina) e da ANVISA sobre uso de IA em saúde. Nosso posicionamento é o de ferramenta de apoio à decisão, não de dispositivo médico autônomo.

### 5.7 CTA final (`components/landing/final-cta.tsx`)

**Headline (h2):** Pronto para uma segunda opinião com base em ciência?
**Subhead:** Crie sua conta em dois minutos e envie seus exames. Sem cartão de crédito, sem compromisso.
**CTA primary:** `Comece agora` → `/register`
**CTA secundário (link):** `Já tenho conta` → `/login`

Visual: card largo com `bg-primary` e `text-primary-foreground` — versão "invertida" das demais seções.

### 5.8 Site header (`components/layout/site-header.tsx`)

Substitui a nav atual em `app/(public)/layout.tsx`.

- À esquerda: logo wordmark (link para `/`)
- À direita: `Sign in` (link para `/login`) + `Comece agora` (botão `variant=default`, link para `/register`)
- Mobile: layout colapsa; CTA continua visível, "Sign in" pode virar texto-link compacto

`<header>` semântico, `border-b border-border`, sticky opcional (decisão do plan).

### 5.9 Site footer (`components/layout/site-footer.tsx`)

Grid 4 colunas em desktop, 2 em tablet, 1 em mobile.

**Coluna 1 — Marca**
- Wordmark
- Tagline: *Uma segunda opinião baseada em ciência.*

**Coluna 2 — Produto**
- Como funciona → `#como-funciona`
- Benefícios → `#beneficios`
- Confiabilidade → `#confiabilidade`
- FAQ → `#faq`

**Coluna 3 — Empresa**
- Sobre — `#` (placeholder, marcar TBD no spec)
- Contato — `mailto:contato@segundaopiniao.com.br` (TBD: confirmar endereço real)

**Coluna 4 — Legal**
- Política de Privacidade → `/privacidade`
- Termos de Uso → `/termos`

**Linha inferior** (`border-t`):
> © 2026 Segunda Opinião · A Segunda Opinião é uma ferramenta de apoio à decisão e não substitui a avaliação de um médico habilitado.

### 5.10 Páginas legais stub

Cada uma com a mesma estrutura: `<h1>` + banner "Versão preliminar. Texto final em revisão jurídica." + 4-6 parágrafos.

**`app/(public)/privacidade/page.tsx`** cobre, em prosa direta:
- Dados coletados (cadastro: e-mail, senha hashed; exames enviados)
- Bases legais LGPD: consentimento + execução de contrato
- Criptografia em trânsito e em repouso
- Retenção e exclusão (direito do titular)
- Direitos do titular: acesso, correção, portabilidade, exclusão
- DPO / encarregado de dados (placeholder de e-mail)

**`app/(public)/termos/page.tsx`** cobre:
- Natureza do serviço (apoio à decisão; não é dispositivo médico)
- Limitação de responsabilidade
- Necessidade de validação por médico habilitado
- Propriedade intelectual
- Foro

Ambos com `metadata` própria (`Política de Privacidade · Segunda Opinião`, etc.).

---

## 6. Metadata e SEO

### `app/layout.tsx`
- `<html lang="pt-BR">`
- `next/font/google` carrega Figtree e Noto Sans, expõe variáveis CSS no `<html>`
- Metadata raiz:
  - `metadataBase`: `https://segundaopiniao.com.br` (TBD: confirmar URL real antes do deploy)
  - `title.default`: `Segunda Opinião — Uma segunda opinião médica baseada em ciência`
  - `title.template`: `%s · Segunda Opinião`
  - `description`: ~155 chars derivada da subhead do hero
  - `openGraph` + `twitter`: imagem `/og-image.png` (1200×630, fundo branco, wordmark + tagline)
  - `robots`: `{ index: true, follow: true }`

### OG image
Decisão da implementação: arquivo estático em `public/og-image.png` (mais simples) **ou** `app/opengraph-image.tsx` (route handler do Next 16, que pode gerar dinamicamente). O **plan deve consultar `node_modules/next/dist/docs/`** para confirmar a API atual antes de escolher.

---

## 7. Acessibilidade (WCAG AA)

- Skip link `Pular para o conteúdo` no topo (visível só em `:focus`)
- Hierarquia: 1× `h1` (hero), demais com `h2`, subitens com `h3`
- Cada seção tem `id` (`#como-funciona`, `#beneficios`, `#confiabilidade`, `#faq`) usado pelo footer e pelo CTA secundário do hero
- Focus ring de 3px (`ring`) em todos os interativos; nunca remover `outline` sem alternativa
- Accordion: keyboard nav garantida pelo Radix (Space/Enter, Arrow keys)
- `prefers-reduced-motion`: scroll smooth e animações de accordion são desativados via `@media`
- Alt text descritivo na OG image
- Ícones decorativos com `aria-hidden="true"`
- Botões e links com label textual visível (sem botão só-ícone na landing)

---

## 8. Responsividade

Mobile-first. Breakpoints Tailwind padrão:
- `< 640px` (mobile): coluna única; hero CTAs full-width; FAQ ocupa 100%
- `640-1024px` (tablet): grids 2 colunas (benefícios, passos)
- `≥ 1024px` (desktop): grids 4 colunas (Como funciona, Benefícios); container max `1120px`

Container central: `max-w-[1120px] mx-auto px-6 md:px-8`.

---

## 9. Performance

- **LCP:** hero é puro texto + ícone — sem imagens grandes; alvo < 1.5s
- **CLS:** 0 — `next/font` evita FOIT/FOUT; sem imagens dinâmicas no fold
- **Fontes:** `display: swap`. `preload: true` apenas no Figtree (heading do hero); Noto Sans `preload: false`
- **Server components por default.** Único client component: `faq.tsx` (Radix Accordion exige `'use client'`). Hero, How it works, Benefits, Reliability, Final CTA, Header, Footer — todos server components.
- **Lighthouse target:** ≥ 95 em Performance, Acessibilidade, Best Practices, SEO

---

## 10. Estratégia de testes (Jest, já configurado)

Foco em **smoke tests** — landing é estática e a copy literal não vale como assertion (frágil contra reescrita).

### `__tests__/landing/page.test.tsx`
- Renderiza sem erro
- `<h1>` presente e não vazio
- Botão "Comece agora" tem `href="/register"`
- Link "Como funciona" no hero aponta para `#como-funciona`
- As seis seções estão montadas (verificado por `data-testid` em cada componente: `hero`, `how-it-works`, `benefits`, `reliability`, `faq`, `final-cta`)
- Footer tem links para `/privacidade` e `/termos`

### `__tests__/legal/privacidade.test.tsx` e `__tests__/legal/termos.test.tsx`
- Cada um renderiza sem erro
- `<h1>` presente e não vazio
- Banner "Versão preliminar" presente

Não vou criar testes unitários de cada componente isolado — overhead sem valor para apresentação puramente declarativa.

---

## 11. Itens TBD a confirmar antes/durante o plan

| Item | Default no spec | Quem decide |
|---|---|---|
| URL de produção / `metadataBase` | `https://segundaopiniao.com.br` | Usuário |
| E-mail de contato real | `contato@segundaopiniao.com.br` | Usuário |
| OG image: estático vs. `next/og` route | A decidir no plan após checar docs do Next 16 | Plan |
| API atual de `Metadata` no Next 16 | A confirmar contra `node_modules/next/dist/docs/` | Plan |
| Geração visual da OG image | Imagem manual ou via `next/og` | Plan |
| Inclusão de CNPJ no footer | Não incluído por default | Usuário |

Esses itens **não bloqueiam** a aprovação do spec, mas devem ser endereçados no plan/implementação.

---

## 12. Critérios de aceitação

A entrega está completa quando:

1. `app/(public)/page.tsx` exibe a landing PT-BR com as seis seções na ordem definida
2. `/privacidade` e `/termos` renderizam stubs com banner "Versão preliminar"
3. Header e footer aparecem em todas as páginas do route group `(public)`
4. Tokens de cor e fontes estão em `app/globals.css` via `@theme`; classes Tailwind como `bg-primary`, `font-heading` funcionam
5. Botão "Comece agora" navega para `/register`; CTAs secundários ancoram corretamente nas seções
6. Lighthouse local (modo Desktop) marca ≥ 95 nas quatro categorias
7. Smoke tests passam (`npm test`)
8. Página é navegável por teclado de ponta a ponta; focus ring visível
9. Verificado em 375px, 768px, 1024px, 1440px sem horizontal scroll nem layout quebrado
10. `prefers-reduced-motion` respeitado

---

## 13. Próximos passos

1. Usuário revisa este spec e aprova ou pede ajustes
2. Após aprovação, invocar **superpowers:writing-plans** para criar plano de implementação detalhado
3. Plan deve checar `node_modules/next/dist/docs/` antes de definir APIs específicas do Next 16
