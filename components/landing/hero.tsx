import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function Hero() {
  return (
    <section
      data-testid="hero"
      className="border-b border-border bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
            Uma segunda opinião médica em minutos, baseada em evidências
            científicas.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
            Envie seus exames e receba uma análise probabilística feita por uma
            IA especializada, fundamentada em milhares de artigos científicos.
            Para você decidir os próximos passos com mais segurança — junto com
            o seu médico.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'w-full sm:w-auto'
              )}
            >
              Comece agora
            </Link>
            <Link
              href="#como-funciona"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'w-full sm:w-auto'
              )}
            >
              Como funciona
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck
              className="h-4 w-4 text-secondary"
              aria-hidden="true"
            />
            Cadastro gratuito · Dados protegidos pela LGPD · Sua segunda opinião
            complementa, não substitui, seu médico.
          </p>
        </div>
      </div>
    </section>
  )
}
