import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso',
}

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
      <p
        role="status"
        className="mb-8 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
      >
        Versão preliminar. Texto final em revisão jurídica.
      </p>
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Termos de Uso
      </h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          Ao usar a Segunda Opinião, você concorda com estes termos. Eles
          descrevem o que oferecemos, suas responsabilidades e os limites do
          serviço.
        </p>
        <p>
          <strong className="font-semibold">Natureza do serviço.</strong> A
          Segunda Opinião é uma ferramenta de apoio à decisão clínica baseada
          em inteligência artificial. Não é dispositivo médico, não emite
          prescrições, atestados ou laudos oficiais.
        </p>
        <p>
          <strong className="font-semibold">
            Validação por médico habilitado.
          </strong>{' '}
          Toda decisão clínica — diagnóstico, tratamento, medicação,
          procedimento — deve ser tomada em conjunto com um médico
          regularmente habilitado.
        </p>
        <p>
          <strong className="font-semibold">
            Limitação de responsabilidade.
          </strong>{' '}
          O conteúdo gerado é apresentado em forma probabilística e tem caráter
          informativo. Não nos responsabilizamos por decisões clínicas tomadas
          sem o devido acompanhamento médico.
        </p>
        <p>
          <strong className="font-semibold">
            Propriedade intelectual.
          </strong>{' '}
          O software, a marca e os relatórios produzidos são propriedade da
          Segunda Opinião. Você mantém a titularidade dos seus dados pessoais
          e exames.
        </p>
        <p>
          <strong className="font-semibold">Foro.</strong> Eventuais
          controvérsias serão dirimidas no foro da Comarca de São Paulo (SP).
        </p>
      </div>
    </article>
  )
}
