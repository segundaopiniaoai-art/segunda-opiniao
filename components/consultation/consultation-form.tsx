'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PdfDropzone } from './pdf-dropzone'
import { PatientContextInput } from './patient-context-input'
import { SpecialistPicker, type Specialist } from './specialist-picker'
import {
  createConsultation,
  confirmConsultationUpload,
} from '@/actions/consultation'
import { Button } from '@/components/ui/button'

type UploadProgress = {
  fileName: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

type Props = {
  specialists: Specialist[]
}

export function ConsultationForm({ specialists }: Props) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [patientContext, setPatientContext] = useState('')
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])

  const canSubmit = files.length > 0 && selectedSpecialistId && !isSubmitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)
    setUploadProgress([])

    const result = await createConsultation({
      specialistId: selectedSpecialistId!,
      patientContext: patientContext.trim() || undefined,
      files: files.map((f) => ({ name: f.name, size: f.size })),
    })

    if ('error' in result) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    const progress: UploadProgress[] = files.map((f) => ({
      fileName: f.name,
      status: 'pending',
    }))
    setUploadProgress([...progress])

    let allUploaded = true

    for (let i = 0; i < files.length; i++) {
      progress[i].status = 'uploading'
      setUploadProgress([...progress])

      const uploadUrl = result.uploadUrls.find((u) => u.fileName === files[i].name)
      if (!uploadUrl) {
        progress[i].status = 'error'
        allUploaded = false
        continue
      }

      try {
        const response = await fetch(uploadUrl.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: files[i],
        })
        if (!response.ok) throw new Error('Upload failed')
        progress[i].status = 'done'
      } catch {
        progress[i].status = 'error'
        allUploaded = false
      }

      setUploadProgress([...progress])
    }

    if (!allUploaded) {
      setError('Falha no upload de alguns arquivos. Tente novamente.')
      setIsSubmitting(false)
      return
    }

    const confirmResult = await confirmConsultationUpload(result.consultationId)

    if ('error' in confirmResult) {
      setError(confirmResult.error)
      setIsSubmitting(false)
      return
    }

    router.push(`/consultas/${result.consultationId}`)
  }, [canSubmit, selectedSpecialistId, patientContext, files, router])

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">1. Envie seus exames</h2>
        <PdfDropzone files={files} onChange={setFiles} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">2. Conte sobre seu caso</h2>
        <PatientContextInput value={patientContext} onChange={setPatientContext} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">3. Escolha o especialista</h2>
        <SpecialistPicker
          specialists={specialists}
          selectedId={selectedSpecialistId}
          onSelect={setSelectedSpecialistId}
        />
      </section>

      {uploadProgress.length > 0 && (
        <div className="space-y-1">
          {uploadProgress.map((p) => (
            <div key={p.fileName} className="flex items-center gap-2 text-sm">
              <span
                className={
                  p.status === 'done'
                    ? 'text-success'
                    : p.status === 'error'
                      ? 'text-destructive'
                      : 'text-gray-400'
                }
              >
                {p.status === 'done'
                  ? '✓'
                  : p.status === 'error'
                    ? '✗'
                    : p.status === 'uploading'
                      ? '↑'
                      : '·'}
              </span>
              <span>{p.fileName}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
        {isSubmitting ? 'Enviando...' : 'Solicitar Segunda Opinião'}
      </Button>
    </div>
  )
}
