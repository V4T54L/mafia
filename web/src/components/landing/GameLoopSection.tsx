import { motion } from 'framer-motion'

export function GameLoopSection() {
  return (
    <section className="py-20 px-4 bg-bg-elevated">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <h2 className="font-display text-4xl md:text-5xl text-center text-text-primary mb-12 tracking-wide">
          THE GAME LOOP
        </h2>
      </motion.div>

      <div className="max-w-md mx-auto flex flex-col gap-4">
        {/* Night Phase */}
        <motion.div
          className="bg-bg-primary rounded-2xl p-6 border border-accent-neutral/20 relative overflow-hidden"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, margin: '-50px' }}
        >
          {/* Subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent-neutral/5 to-transparent pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🌙</span>
              <h3 className="font-display text-2xl text-text-primary tracking-wide">NIGHT</h3>
            </div>
            <p className="text-body text-text-secondary leading-relaxed">
              The town sleeps. The Mafia whispers. The Doctor chooses who to save. The Detective
              searches for truth. By morning, someone might be gone forever.
            </p>
          </div>
        </motion.div>

        {/* Arrow */}
        <motion.div
          className="flex justify-center py-2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          viewport={{ once: true }}
        >
          <motion.svg
            className="w-6 h-6 text-text-disabled"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </motion.svg>
        </motion.div>

        {/* Day Phase */}
        <motion.div
          className="bg-bg-primary rounded-2xl p-6 border border-accent-warning/20 relative overflow-hidden"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true, margin: '-50px' }}
        >
          {/* Subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent-warning/5 to-transparent pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">☀️</span>
              <h3 className="font-display text-2xl text-text-primary tracking-wide">DAY</h3>
            </div>
            <p className="text-body text-text-secondary leading-relaxed">
              Everyone wakes up. Accusations fly. Alibis crumble. Vote to eliminate a suspect—but
              the Mafia is voting too, pointing fingers at the innocent.
            </p>
          </div>
        </motion.div>

        {/* Loop indicator */}
        <motion.div
          className="flex justify-center py-2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          viewport={{ once: true }}
        >
          <motion.svg
            className="w-6 h-6 text-text-disabled"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </motion.svg>
        </motion.div>

        {/* Win Conditions */}
        <motion.div
          className="text-center text-sm text-text-secondary space-y-1 pt-2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          viewport={{ once: true }}
        >
          <p>
            <span className="text-accent-town font-semibold">Town wins</span> — eliminate all Mafia
          </p>
          <p>
            <span className="text-accent-mafia font-semibold">Mafia wins</span> — match or outnumber
            the Town
          </p>
        </motion.div>
      </div>
    </section>
  )
}
