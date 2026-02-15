import { motion } from 'framer-motion'

const features = [
  {
    icon: '🎙️',
    title: 'Voice-First',
    description:
      'Not text. Not video. Just voices. Hear the hesitation. Catch the lie. Read between the words.',
  },
  {
    icon: '⚡',
    title: 'Zero Setup',
    description: "Skip the \"everyone download this app\" chaos. Share a link. That's it.",
  },
  {
    icon: '🤖',
    title: 'Auto-Moderated',
    description: 'No one sits out to run the game. The app handles it. Everyone plays. Everyone lies.',
  },
  {
    icon: '👻',
    title: 'Fair for the Dead',
    description:
      "Die early? You're a ghost now. Listen to your friends blame each other. You can't help. It's beautiful.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

export function WhyMafiaSection() {
  return (
    <section className="py-20 px-4 bg-bg-primary">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <h2 className="font-display text-4xl md:text-5xl text-center text-text-primary mb-12 tracking-wide">
          WHY MAFIA?
        </h2>
      </motion.div>

      <motion.div
        className="flex flex-col gap-4 max-w-md mx-auto"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={itemVariants}
            className="bg-bg-surface rounded-2xl p-5 hover:bg-bg-elevated transition-colors duration-300"
          >
            <div className="flex items-start gap-4">
              <span className="text-2xl flex-shrink-0 mt-1">{feature.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-1">{feature.title}</h3>
                <p className="text-body text-text-secondary leading-relaxed">{feature.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
