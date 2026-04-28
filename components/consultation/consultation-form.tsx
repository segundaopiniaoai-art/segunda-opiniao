'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PdfDropzone } from './pdf-dropzone'
import { PatientContextInput } from './patient-context-input'
import { SpecialistPicker, type Specialist } from './specialist-picker'
import { FormStepper, type StepState } from './form-stepper'
import {
  FileUploadProgress,
  type FileProgress,
  type FileUploadStatus,
} from './file-upload-progress'
import {
  createConsultation,
  confirmConsultationUpload,
} from '@/actions/consultation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type Props = {
  specialists: Specialist[]
}

type SubmitPhase =
  | null
  | { type: 'uploading' }
  | { type: 'success' }
  | { type: 'upload-error' }
  | { type: 'confirm-error'; message: string; retryCount: number }

export function ConsultationForm({ specialists }: Props) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [patientContext, setPatientContext] = useState('')
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>(null)
  const consultationIdRef = useRef<string | null>(null)
  const uploadUrlsRef = useRef<{ fileName: string; url: string }[]>([])
  const confirmRetryCountRef = useRef(0)

  const ref0 = useRef<HTMLElement>(null)
  const ref1 = useRef<HTMLElement>(null)
  const ref2 = useRef<HTMLElement>(null)
  const sectionRefs = [ref0, ref1, ref2]

  const canSubmit = files.length > 0 && selectedSpecialistId && !isSubmitting

  // beforeunload protection during upload
  useEffect(() => {
    if (!isSubmitting) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isSubmitting])

  const stepperSteps = useMemo(() => [
    { label: 'Exames', ref: sectionRefs[0] },
    { label: 'Contexto', ref: sectionRefs[1] },
    { label: 'Especialista', ref: sectionRefs[2] },
  ], [])

  const completionState: StepState[] = [
    files.length > 0 ? 'complete' : 'current',
    'complete', // always complete (optional field)
    selectedSpecialistId ? 'complete' : files.length > 0 ? 'current' : 'future',
  ]

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)
    setSubmitPhase({ type: 'uploading' })

    const progress: FileProgress[] = files.map((f) => ({
      fileName: f.name,
      fileSize: f.size,
      status: 'pending' as FileUploadStatus,
    }))
    setFileProgress([...progress])

    const result = await createConsultation({
      specialistId: selectedSpecialistId!,
      patientContext: patientContext.trim() || undefined,
      files: files.map((f) => ({ name: f.name, size: f.size })),
    })

    if ('error' in result) {
      setError(result.error)
      setIsSubmitting(false)
      setSubmitPhase(null)
      return
    }

    consultationIdRef.current = result.consultationId
    uploadUrlsRef.current = result.uploadUrls

    await uploadFiles(files, result.uploadUrls, progress, result.consultationId)
  }, [canSubmit, selectedSpecialistId, patientContext, files])

  const uploadFiles = async (
    filesToUpload: File[],
    urls: { fileName: string; url: string }[],
    progress: FileProgress[],
    conId: string
  ) => {
    let allUploaded = true

    for (let i = 0; i < filesToUpload.length; i++) {
      if (progress[i].status === 'done') continue // skip already uploaded

      progress[i].status = 'uploading'
      setFileProgress([...progress])

      const uploadUrl = urls.find((u) => u.fileName === filesToUpload[i].name)
      if (!uploadUrl) {
        progress[i].status = 'error'
        progress[i].error = 'URL de upload nao encontrada'
        allUploaded = false
        setFileProgress([...progress])
        continue
      }

      try {
        const response = await fetch(uploadUrl.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: filesToUpload[i],
        })
        if (!response.ok) throw new Error('Upload failed')
        progress[i].status = 'done'
      } catch {
        progress[i].status = 'error'
        progress[i].error = 'Falha no envio'
        allUploaded = false
      }

      setFileProgress([...progress])
    }

    if (!allUploaded) {
      setSubmitPhase({ type: 'upload-error' })
      setIsSubmitting(false)
      return
    }

    // All uploaded — confirm
    setSubmitPhase({ type: 'success' })
    await new Promise((r) => setTimeout(r, 800))

    await confirmUpload(conId)
  }

  const confirmUpload = async (id: string) => {
    if (!id) return

    const confirmResult = await confirmConsultationUpload(id)

    if ('error' in confirmResult) {
      confirmRetryCountRef.current += 1
      setSubmitPhase({
        type: 'confirm-error',
        message: 'Seus exames foram enviados, mas houve um erro ao iniciar a analise. Tente novamente.',
        retryCount: confirmRetryCountRef.current,
      })
      setIsSubmitting(false)
      return
    }

    router.push(`/consultas/${id}`)
  }

  const handleRetryFailed = useCallback(() => {
    const conId = consultationIdRef.current
    if (!conId) return

    if (submitPhase?.type === 'confirm-error') {
      setIsSubmitting(true)
      confirmUpload(conId)
      return
    }

    // Retry failed file uploads
    setIsSubmitting(true)
    setSubmitPhase({ type: 'uploading' })
    const progress = [...fileProgress]
    progress.forEach((p) => {
      if (p.status === 'error') p.status = 'pending'
    })
    setFileProgress(progress)
    uploadFiles(files, uploadUrlsRef.current, progress, conId)
  }, [submitPhase, fileProgress, files])

  const handleBackToForm = useCallback(() => {
    setSubmitPhase(null)
    setIsSubmitting(false)
    setFileProgress([])
    consultationIdRef.current = null
    uploadUrlsRef.current = []
    confirmRetryCountRef.current = 0
    setError(null)
  }, [])

  return (
    <div className="max-w-2xl pb-36 lg:pb-0">
      <FormStepper
        steps={stepperSteps}
        completionState={completionState}
        isSending={isSubmitting}
      />

      <div
        className={cn(
          'space-y-0',
          isSubmitting && 'opacity-50 pointer-events-none'
        )}
      >
        <section ref={sectionRefs[0]} className="py-6">
          <h2 className="font-heading text-lg font-semibold mb-1">
            Envie seus exames
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Selecione os arquivos PDF dos seus exames.
          </p>
          <PdfDropzone files={files} onChange={setFiles} />
        </section>

        <div className="border-t border-border" />

        <section ref={sectionRefs[1]} className="py-6">
          <h2 className="font-heading text-lg font-semibold mb-1">
            Conte sobre seu caso
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Opcional. Compartilhe contexto que possa ajudar na analise.
          </p>
          <PatientContextInput value={patientContext} onChange={setPatientContext} />
        </section>

        <div className="border-t border-border" />

        <section ref={sectionRefs[2]} className="py-6">
          <h2 className="font-heading text-lg font-semibold mb-1">
            Escolha o especialista
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Selecione o tipo de especialista para analisar seus exames.
          </p>
          <SpecialistPicker
            specialists={specialists}
            selectedId={selectedSpecialistId}
            onSelect={setSelectedSpecialistId}
          />
        </section>
      </div>

      {submitPhase && (
        <div className="mt-6">
          <FileUploadProgress
            files={fileProgress}
            phase={submitPhase}
            onRetryFailed={handleRetryFailed}
            onBackToForm={handleBackToForm}
          />
        </div>
      )}

      {error && !submitPhase && (
        <p className="text-sm text-destructive mt-4">{error}</p>
      )}

      {!submitPhase && (
        <div className="mt-6 lg:block fixed bottom-16 inset-x-0 p-4 bg-surface border-t border-border z-30 lg:static lg:p-0 lg:border-0 lg:bg-transparent">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
          >
            {isSubmitting ? 'Enviando...' : 'Solicitar Segunda Opiniao'}
          </Button>
        </div>
      )}
    </div>
  )
}
