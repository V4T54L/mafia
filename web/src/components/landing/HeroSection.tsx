import { Button } from '../ui'

export function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center bg-bg-primary">
      {/* Logo */}
      <div className="mb-6">
        <h1 className="text-display font-bold tracking-tight text-text-primary">MAFIA</h1>
      </div>

      {/* Tagline */}
      <p className="text-headline text-text-secondary mb-8 max-w-md">
        A remote social deduction game with no moderator and no mercy.
      </p>

      {/* CTA Buttons - in thumb zone */}
      <div className="flex flex-col gap-4 w-full max-w-xs mt-auto mb-8">
        <Button size="lg" fullWidth>
          Play Now
        </Button>
        <Button variant="secondary" size="lg" fullWidth>
          Join Game
        </Button>
      </div>

      {/* Scroll hint */}
      <div className="animate-bounce text-text-disabled">
        <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
        <span className="text-micro">See how it works</span>
      </div>
    </section>
  )
}
