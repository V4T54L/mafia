import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui'

export function HeroSection() {
  const navigate = useNavigate()
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center bg-bg-primary relative overflow-hidden">
      {/* Subtle noise texture */}
      <div className="absolute inset-0 bg-noise" />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-bg-elevated)_0%,_var(--color-bg-primary)_70%)]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h1 className="font-display text-7xl md:text-8xl tracking-wide text-text-primary">
            MAFIA
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="text-2xl md:text-3xl text-text-secondary mb-3 max-w-md font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          "Someone in this call is lying to you."
        </motion.p>

        {/* Subtext */}
        <motion.p
          className="text-lg text-text-disabled mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          A voice-only game of deception for 6-12 friends.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col gap-4 w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Button size="lg" fullWidth variant="danger" glow onClick={() => navigate('/join')}>
            Start Hunting
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/join')}>
            I Have a Code
          </Button>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="mt-16 text-text-disabled"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          >
            <span className="text-sm">How it works</span>
            <svg
              className="w-5 h-5 mx-auto mt-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
