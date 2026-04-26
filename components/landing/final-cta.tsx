import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function FinalCta() {
  return (
    <section
      data-testid="final-cta"
      className="bg-background"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-16 md:px-8 md:py-20">
        <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground md:px-16">
          <h2 className="mx-auto max-w-2xl font-heading text-3xl font-bold md:text-4xl">
            Pronto para uma segunda opinião com base em ciência?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/90 md:text-lg">
            Crie sua conta em dois minutos e envie seus exames. Sem cartão de
            crédito, sem compromisso.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'w-full bg-surface text-primary hover:bg-background sm:w-auto'
              )}
            >
              Comece agora
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-primary-foreground/90 underline-offset-4 hover:underline"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
