import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-[1120px] px-6 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-heading text-base font-bold text-foreground">
              Segunda <span className="text-primary">Opinião</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Uma segunda opinião baseada em ciência.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Produto
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/#como-funciona" className="hover:text-foreground">
                  Como funciona
                </Link>
              </li>
              <li>
                <Link href="/#beneficios" className="hover:text-foreground">
                  Benefícios
                </Link>
              </li>
              <li>
                <Link href="/#confiabilidade" className="hover:text-foreground">
                  Confiabilidade
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-foreground">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Empresa
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="mailto:contato@segundaopiniao.com.br"
                  className="hover:text-foreground"
                >
                  Contato
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Legal
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacidade" className="hover:text-foreground">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos" className="hover:text-foreground">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © 2026 Segunda Opinião · A Segunda Opinião é uma ferramenta de apoio
          à decisão e não substitui a avaliação de um médico habilitado.
        </p>
      </div>
    </footer>
  )
}
