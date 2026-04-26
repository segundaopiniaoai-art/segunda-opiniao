import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
      <p
        role="status"
        className="mb-8 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
      >
        Versão preliminar. Texto final em revisão jurídica.
      </p>
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Política de Privacidade
      </h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          A Segunda Opinião valoriza a sua privacidade. Esta política descreve
          como coletamos, usamos e protegemos seus dados pessoais e médicos, em
          conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº
          13.709/2018).
        </p>
        <p>
          <strong className="font-semibold">Dados coletados.</strong> Para o
          cadastro, coletamos e-mail e senha (armazenada apenas com hash). Para
          a análise, coletamos os exames enviados por você (laudos, imagens) e
          metadados associados.
        </p>
        <p>
          <strong className="font-semibold">Bases legais.</strong> Tratamos
          seus dados com base no seu consentimento e na execução do contrato
          de prestação do serviço.
        </p>
        <p>
          <strong className="font-semibold">Segurança.</strong> Aplicamos
          criptografia em trânsito (TLS 1.3) e em repouso (AES-256). O acesso é
          restrito a sistemas automatizados; ninguém da nossa equipe lê seus
          documentos individualmente.
        </p>
        <p>
          <strong className="font-semibold">
            Direitos do titular.
          </strong>{' '}
          Você pode solicitar a qualquer momento acesso, correção,
          portabilidade, anonimização ou exclusão dos seus dados. A exclusão
          tem efeito imediato.
        </p>
        <p>
          <strong className="font-semibold">Contato do encarregado.</strong>{' '}
          Para exercer seus direitos ou esclarecer dúvidas, escreva para{' '}
          <a
            href="mailto:dpo@segundaopiniao.com.br"
            className="text-primary underline-offset-4 hover:underline"
          >
            dpo@segundaopiniao.com.br
          </a>
          .
        </p>
      </div>
    </article>
  )
}
