'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

type Entry = {
  id: string
  question: string
  answer: string
}

const entries: Entry[] = [
  {
    id: 'precisao',
    question: 'A análise da IA é precisa?',
    answer:
      'A precisão depende da qualidade e completude dos exames enviados. Para casos bem documentados, nossos modelos atingem alta concordância com a literatura médica. Mesmo assim, sempre apresentamos as conclusões como probabilidades e hipóteses — nunca como diagnóstico fechado. Use o relatório como insumo da conversa com o seu médico.',
  },
  {
    id: 'acesso',
    question: 'Quem tem acesso aos meus exames?',
    answer:
      'Apenas você. Arquivos são criptografados em trânsito (TLS 1.3) e em repouso (AES-256). Nossa equipe não acessa documentos individuais de pacientes. Você pode apagar todos os seus dados a qualquer momento, com efeito imediato.',
  },
  {
    id: 'substitui-medico',
    question: 'A Segunda Opinião substitui meu médico?',
    answer:
      'Não — e essa é uma escolha consciente. A ferramenta foi projetada para complementar a avaliação clínica, oferecendo uma leitura adicional fundamentada em literatura científica. Decisões sobre tratamento, medicação ou cirurgia devem ser tomadas com um médico habilitado.',
  },
  {
    id: 'tipos-exame',
    question: 'Que tipos de exame posso enviar?',
    answer:
      'Laudos em PDF, imagens (JPG, PNG) e exames de imagem em formato DICOM. Aceitamos hemograma, bioquímica, ultrassom, ressonância, tomografia, raio-X, biópsias e laudos especializados. Caso um formato não seja suportado, avisamos antes do upload.',
  },
  {
    id: 'preco',
    question: 'Quanto custa?',
    answer:
      'Você cria sua conta gratuitamente. As condições comerciais — planos, créditos ou pagamento por análise — são apresentadas dentro da plataforma após o cadastro, com total transparência antes de qualquer cobrança.',
  },
  {
    id: 'normas-brasileiras',
    question: 'A ferramenta segue as normas brasileiras?',
    answer:
      'Sim. Operamos em conformidade com a LGPD (Lei nº 13.709/2018) e seguimos as orientações do CFM (Resolução nº 2.314/2022 sobre telemedicina) e da ANVISA sobre uso de IA em saúde. Nosso posicionamento é o de ferramenta de apoio à decisão, não de dispositivo médico autônomo.',
  },
]

export function Faq() {
  return (
    <section
      id="faq"
      data-testid="faq"
      className="bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Perguntas frequentes
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Tire suas dúvidas
          </h2>
        </div>
        <div className="mx-auto mt-10 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {entries.map((e) => (
              <AccordionItem key={e.id} value={e.id}>
                <AccordionTrigger>{e.question}</AccordionTrigger>
                <AccordionContent>{e.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
