import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Benefits } from '@/components/landing/benefits'
import { Reliability } from '@/components/landing/reliability'
import { Faq } from '@/components/landing/faq'
import { FinalCta } from '@/components/landing/final-cta'

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Benefits />
      <Reliability />
      <Faq />
      <FinalCta />
    </>
  )
}
