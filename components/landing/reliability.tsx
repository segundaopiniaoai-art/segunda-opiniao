import { Database, ShieldCheck, Stethoscope, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Pillar = {
  icon: LucideIcon
  title: string
  description: string
}

const pillars: Pillar[] = [
  {
    icon: Database,
    title: 'Base científica viva',
    description:
      'Nossa IA consulta continuamente bases de artigos revisados por pares — incluindo PubMed, Cochrane, NEJM, The Lancet e JAMA. Cada conclusão do relatório cita as referências consultadas, para você (ou seu médico) verificar.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidade e LGPD',
    description:
      'Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Sua equipe médica não tem acesso à sua conta. Você pode excluir todos os seus dados a qualquer momento, com efeito imediato. Sem venda, sem compartilhamento.',
  },
  {
    icon: Stethoscope,
    title: 'Posicionamento ético',
    description:
      'A Segunda Opinião é uma ferramenta de apoio à decisão clínica. Não emitimos prescrições, atestados ou laudos oficiais. Toda conduta deve ser validada com um médico habilitado.',
  },
]

export function Reliability() {
  return (
    <section
      id="confiabilidade"
      data-testid="reliability"
      className="bg-background"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Confiabilidade
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Confiabilidade não é opcional.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Uma segunda opinião sobre saúde precisa ser tão rigorosa quanto a
            primeira. Eis como construímos isso.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => {
            const Icon = p.icon
            return (
              <li
                key={p.title}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <Icon
                  className="h-8 w-8 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </li>
            )
          })}
        </ul>
        <div className="mt-10 flex items-start gap-3 rounded-lg border border-border bg-surface px-5 py-4">
          <Scale
            className="mt-0.5 h-5 w-5 shrink-0 text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Em conformidade com a LGPD (Lei nº 13.709/2018) e alinhada às
            orientações do CFM (Resolução nº 2.314/2022) e da ANVISA sobre uso
            de IA em saúde.
          </p>
        </div>
      </div>
    </section>
  )
}
