import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { HeroSection } from '../components/landing/HeroSection'
import { HowItWorksSection } from '../components/landing/HowItWorksSection'
import { RolesSection as RolesShowcase } from '../components/landing/RolesSection'
import { GameLoopSection } from '../components/landing/GameLoopSection'
import { WhyMafiaSection } from '../components/landing/WhyMafiaSection'
import { RulesSection } from '../components/landing/RulesSection'
import { Footer } from '../components/landing/Footer'

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />
      <HowItWorksSection />
      <RolesShowcase />
      <GameLoopSection />
      <RulesSection />
      <WhyMafiaSection />

      {/* Final CTA */}
      <section className="py-20 px-4 text-center bg-bg-primary relative overflow-hidden">
        {/* Subtle radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-bg-elevated)_0%,_var(--color-bg-primary)_70%)] opacity-50" />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <h2 className="font-display text-4xl md:text-5xl text-text-primary mb-6 tracking-wide">
            READY TO HUNT?
          </h2>
          <p className="text-lg text-text-secondary mb-8 max-w-sm mx-auto">
            Gather your friends. Find the traitors. Trust no one.
          </p>
          <Button size="lg" variant="danger" glow className="mb-4" onClick={() => navigate('/join')}>
            Start Hunting
          </Button>
          <p className="text-sm text-text-disabled">Best with 6-12 players</p>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}
