'use client'

import { useState, useTransition } from 'react'
import type { PromptVersion } from '@/lib/admin/specialist-prompts'
import { saveNewVersion, restoreVersion } from '../actions'

type Props = {
  specialistId: string
  currentVersionId: string
  currentVersionNumber: number
  initialContent: string
  versions: PromptVersion[]
}

export function PromptEditor({
  specialistId,
  currentVersionId,
  currentVersionNumber,
  initialContent,
  versions,
}: Props) {
  const [content, setContent] = useState(initialContent)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function clearMessages() {
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  function handleSave() {
    clearMessages()
    startTransition(async () => {
      try {
        await saveNewVersion(specialistId, content)
        setSuccessMsg('Nova versão salva com sucesso.')
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Erro ao salvar.')
      }
    })
  }

  function handleRestore(versionId: string, versionNumber: number) {
    clearMessages()
    startTransition(async () => {
      try {
        await restoreVersion(specialistId, versionId)
        setSuccessMsg(`Versão v${versionNumber} restaurada como nova versão.`)
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Erro ao restaurar.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="prompt-content">
            Prompt do especialista{' '}
            <span className="text-muted-foreground">(versão atual: v{currentVersionNumber})</span>
          </label>
          <button
            onClick={handleSave}
            disabled={isPending || content === initialContent}
            className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {isPending ? 'Salvando…' : 'Salvar nova versão'}
          </button>
        </div>
        <textarea
          id="prompt-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {errorMsg && (
        <p role="alert" className="text-sm text-destructive">{errorMsg}</p>
      )}
      {successMsg && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
      )}

      <div>
        <h2 className="text-sm font-medium mb-3">Histórico de versões</h2>
        <ul className="space-y-1.5">
          {versions.map((v) => {
            const isCurrent = v.id === currentVersionId
            const date = new Date(v.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })
            return (
              <li key={v.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="font-medium">v{v.versionNumber}</span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      atual
                    </span>
                  )}
                  <span className="text-muted-foreground">{date}</span>
                </span>
                {!isCurrent && (
                  <button
                    onClick={() => handleRestore(v.id, v.versionNumber)}
                    disabled={isPending}
                    className="text-primary hover:underline disabled:opacity-50 text-xs font-medium"
                  >
                    Restaurar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
