import { BookOpen, Brain, Clock, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Benefit = {
  icon: LucideIcon
  title: string
  description: string
}

const benefits: Benefit[] = [
  {
    icon: BookOpen,
    title: 'Baseado em evidência científica',
    description:
      'Cada hipótese é justificada com referências a artigos revisados por pares. Não é uma opinião — é o consenso da literatura aplicado ao seu caso.',
  },
  {
    icon: Brain,
    title: 'IA especialista, não generalista',
    description:
      'Treinada para análise médica. As respostas chegam estruturadas como um relatório clínico, não como uma conversa de chat.',
  },
  {
    icon: Clock,
    title: 'Acessível e rápido',
    description:
      'Sem agendamento, sem deslocamento. Em minutos, a qualquer hora.',
  },
  {
    icon: Lock,
    title: 'Privacidade desde o design',
    description:
      'Criptografia ponta a ponta. Seus dados nunca são usados para treinar modelos públicos. Em conformidade total com a LGPD.',
  },
]

export function Benefits() {
  return (
    <section
      id="beneficios"
      data-testid="benefits"
      className="bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Por que uma segunda opinião com IA
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Mais ciência, menos espera.
          </h2>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => {
            const Icon = b.icon
            return (
              <li key={b.title} className="rounded-lg p-6">
                <Icon
                  className="h-7 w-7 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {b.description}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
