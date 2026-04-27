# Design: Fluxo de Criação de Segunda Opinião Médica

**Data:** 2026-04-26
**Status:** Aprovado

## Objetivo

Criar a experiência completa para o usuário solicitar uma segunda opinião médica: upload de exames em PDF, seleção de agente especialista, e acompanhamento do status da consulta.

## Decisões de Design

- Página única (sem wizard/stepper) para criação da consulta
- Upload com drag & drop + botão, preview dos arquivos, possibilidade de remover
- Máximo 5 PDFs, 10MB por arquivo
- Seleção de especialista via cards visuais (ícone, nome, descrição)
- Upload direto ao Supabase Storage via signed URLs (não passa pelo servidor Next.js)
- Lista de especialistas vem de tabela no Supabase (populada com seed data)
- Dashboard atualizado para listar consultas do usuário

## Estrutura de Dados

### Tabela `specialists`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| name | text | Ex: "Cardiologista" |
| description | text | Breve descrição da especialidade |
| icon | text | Emoji ou nome de ícone Lucide |
| active | boolean | Default true, filtra no frontend |
| created_at | timestamptz | Default now() |

### Tabela `consultations`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| user_id | uuid (FK profiles.id) | Quem criou |
| specialist_id | uuid (FK specialists.id) | Agente selecionado |
| status | text | 'pending', 'processing', 'completed' |
| result | text (nullable) | Resposta do agente (futuro) |
| created_at | timestamptz | Default now() |

### Tabela `consultation_files`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| consultation_id | uuid (FK consultations.id) | ON DELETE CASCADE |
| file_name | text | Nome original do arquivo |
| file_size | integer | Tamanho em bytes |
| storage_path | text | Caminho no Storage bucket |
| created_at | timestamptz | Default now() |

### RLS

- `consultations`: usuários só leem/criam onde `auth.uid() = user_id`
- `consultation_files`: acesso via join com `consultations` (mesmo user_id)
- `specialists`: leitura pública onde `active = true`

### Storage

- Bucket: `consultation-files` (privado)
- Estrutura: `{user_id}/{consultation_id}/{file_name}`
- RLS: usuário só acessa seus próprios arquivos
- Signed upload URLs com expiração de 5 minutos

### Seed Data

Especialistas iniciais: Cardiologista, Oncologista, Neurologista, Ortopedista, Dermatologista, Clínico Geral.

## Rotas

| Rota | Grupo | Propósito |
|---|---|---|
| `/consultas/nova` | (protected) | Criação — upload de PDFs + seleção de especialista |
| `/consultas/[id]` | (protected) | Status/resultado de uma consulta |
| `/dashboard` | (protected) | Atualizado com lista de consultas |

## Componentes

| Componente | Responsabilidade |
|---|---|
| `components/consultation/pdf-dropzone.tsx` | Drag & drop + botão, preview dos PDFs, validação (máx 5, 10MB, só PDF), remover arquivo |
| `components/consultation/specialist-picker.tsx` | Grid de cards dos especialistas, seleção single-select |
| `components/consultation/consultation-form.tsx` | Orquestra dropzone + picker + botão enviar |
| `components/consultation/consultation-status.tsx` | Exibe status, arquivos e resultado na página [id] |
| `components/dashboard/consultation-list.tsx` | Lista de consultas no dashboard |

## Fluxo de Upload e Criação

### Fluxo do usuário

1. Usuário arrasta/seleciona PDFs no dropzone (validação client-side)
2. Seleciona um especialista nos cards
3. Clica em "Solicitar Segunda Opinião"
4. Botão entra em estado de loading

### Fluxo técnico

1. **Client** chama Server Action `createConsultation(specialistId, filesMetadata)`
2. **Server Action:**
   - Valida sessão do usuário
   - Valida specialist_id existe e está ativo
   - Cria registro em `consultations` (status: 'pending')
   - Cria registros em `consultation_files` com storage_paths esperados
   - Gera signed upload URLs para cada arquivo via Supabase Storage
   - Retorna `{ consultationId, uploadUrls[] }`
3. **Client** faz upload direto ao Storage para cada arquivo (com progress tracking)
4. **Client** chama Server Action `confirmConsultationUpload(consultationId)` após todos os uploads
5. **Server Action** verifica arquivos no Storage, atualiza status para 'processing'
6. **Client** redireciona para `/consultas/[id]`

### Tratamento de erros

- Upload falha em arquivo específico: mostra erro naquele arquivo, permite retry individual
- Criação no banco falha: mensagem genérica de erro, formulário preserva estado
- Usuário fecha a página no meio: consulta fica como 'pending', pode ser limpa por job futuro

## Página de Status (`/consultas/[id]`)

- **Header:** título com data + badge de status colorido
  - `pending` → amarelo, "Aguardando upload"
  - `processing` → azul, "Em processamento"
  - `completed` → verde, "Concluída"
- **Seção Especialista:** card com ícone e nome
- **Seção Arquivos:** lista dos PDFs enviados (nome, tamanho)
- **Seção Resultado:** placeholder "O resultado aparecerá aqui quando a análise for concluída" (preenchido quando `result` não for null)
- **Botão voltar:** link para `/dashboard`
- **Acesso:** RLS garante que só o dono acessa. Outros recebem 404.

## Dashboard Atualizado

- **Header:** "Minhas Consultas" + botão "Nova Consulta"
- **Lista:** cards com especialidade (ícone + nome), status (badge), data. Clicável → `/consultas/[id]`
- **Estado vazio:** ícone + "Você ainda não tem consultas" + botão "Criar sua primeira consulta"
- **Ordenação:** mais recentes primeiro

## Validações

| Camada | Validação |
|---|---|
| Client | Tipo PDF, máx 5 arquivos, 10MB por arquivo, pelo menos 1 arquivo, especialista selecionado |
| Server Action | Sessão válida, specialist_id existe e ativo, re-valida limites |
| RLS | User só acessa próprias consultas e arquivos |
| Storage | Signed URLs com expiração curta (~5 min), path restrito ao user_id |

## Fora de Escopo

- Criação/edição de agentes especialistas (feature futura)
- Integração real com Claude Managed Agents (o status ficará como 'processing' sem resolução automática por enquanto)
- Notificações por email
- Histórico de versões de resultado
