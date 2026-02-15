import { motion } from 'framer-motion'

const steps = [
  {
    number: 1,
    icon: '🔗',
    title: 'Drop a Code',
    description: "Share a link in your group chat. Thirty seconds later, everyone's in.",
  },
  {
    number: 2,
    icon: '🎭',
    title: 'Get Your Role',
    description: "Your screen says MAFIA. Your heart races. Can they tell? They can't. Probably.",
  },
  {
    number: 3,
    icon: '👂',
    title: 'Listen Closely',
    description: 'Hear the pause. The excuse that comes too fast. The voice that cracks.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

export function HowItWorksSection() {
  return (
    <section className="py-20 px-4 bg-bg-elevated">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <h2 className="font-display text-4xl md:text-5xl text-center text-text-primary mb-12 tracking-wide">
          HOW IT WORKS
        </h2>
      </motion.div>

      <motion.div
        className="flex flex-col gap-6 max-w-md mx-auto"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
      >
        {steps.map((step) => (
          <motion.div
            key={step.number}
            variants={itemVariants}
            className="bg-bg-surface rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden group"
          >
            {/* Step number badge */}
            <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-accent-neutral/20 flex items-center justify-center">
              <span className="text-sm font-bold text-accent-neutral">{step.number}</span>
            </div>

            <div className="text-4xl mb-3 mt-2">{step.icon}</div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">{step.title}</h3>
            <p className="text-body text-text-secondary leading-relaxed">{step.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
