import { UserPlus, FileUp, Sparkles, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Step = {
  icon: LucideIcon
  title: string
  description: string
}

const steps: Step[] = [
  {
    icon: UserPlus,
    title: 'Crie sua conta',
    description:
      'Em menos de dois minutos, com o mínimo de informação.',
  },
  {
    icon: FileUp,
    title: 'Envie seus exames',
    description:
      'Laudos em PDF ou imagem. Tudo criptografado de ponta a ponta.',
  },
  {
    icon: Sparkles,
    title: 'Análise por IA especialista',
    description:
      'Um agente treinado em medicina cruza seus dados com milhares de estudos.',
  },
  {
    icon: FileText,
    title: 'Receba o relatório',
    description:
      'Hipóteses probabilísticas, justificadas, com referências à literatura.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      data-testid="how-it-works"
      className="bg-background"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Como funciona
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Quatro passos simples para mais clareza
          </h2>
        </div>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li
                key={step.title}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <Icon
                    className="h-8 w-8 text-secondary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
