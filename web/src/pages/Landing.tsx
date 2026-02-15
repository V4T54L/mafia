import { Button } from '../components/ui'
import { HeroSection } from '../components/landing/HeroSection'
import { HowItWorksSection } from '../components/landing/HowItWorksSection'
import { RolesSection } from '../components/landing/RolesSection'
import { GameLoopSection } from '../components/landing/GameLoopSection'
import { WhyMafiaSection } from '../components/landing/WhyMafiaSection'
import { Footer } from '../components/landing/Footer'

export function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />
      <HowItWorksSection />
      <RolesSection />
      <GameLoopSection />
      <WhyMafiaSection />

      {/* Final CTA */}
      <section className="py-12 px-4 text-center bg-bg-primary">
        <h2 className="text-title font-bold text-text-primary mb-6">Ready to find the Mafia?</h2>
        <Button size="lg" className="mb-4">
          Play Now
        </Button>
        <p className="text-caption text-text-secondary">Works best with 6-12 players</p>
      </section>

      <Footer />
    </div>
  )
}
