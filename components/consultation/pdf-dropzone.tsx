'use client'

import { useCallback, useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024

type Props = {
  files: File[]
  onChange: (files: File[]) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PdfDropzone({ files, onChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndAdd = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles || newFiles.length === 0) return
      setError(null)
      const incoming = Array.from(newFiles)

      const nonPdf = incoming.find(
        (f) => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')
      )
      if (nonPdf) {
        setError('Apenas arquivos PDF são aceitos')
        return
      }

      const tooBig = incoming.find((f) => f.size > MAX_FILE_SIZE)
      if (tooBig) {
        setError(`"${tooBig.name}" excede o limite de 10MB`)
        return
      }

      if (files.length + incoming.length > MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} arquivos permitidos`)
        return
      }

      onChange([...files, ...incoming])
    },
    [files, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      validateAndAdd(e.dataTransfer.files)
    },
    [validateAndAdd]
  )

  const handleRemove = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index))
      setError(null)
    },
    [files, onChange]
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <FileUp className="mx-auto h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600">
          Arraste seus arquivos PDF aqui ou{' '}
          <span className="text-primary font-medium">clique para selecionar</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Máximo {MAX_FILES} arquivos, até 10MB cada
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            validateAndAdd(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 bg-red-50 rounded flex items-center justify-center">
                  <span className="text-xs font-medium text-red-600">PDF</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label="Remover"
                className="flex-shrink-0 p-1 text-gray-400 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
