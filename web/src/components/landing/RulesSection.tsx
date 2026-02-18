import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const rules = [
  {
    title: 'Objective',
    icon: '🎯',
    content: [
      'Town wins by eliminating all Mafia members',
      'Mafia wins when they equal or outnumber the Town',
    ],
  },
  {
    title: 'Night Phase',
    icon: '🌙',
    content: [
      'Mafia secretly chooses a player to eliminate',
      'Doctor can protect one player from death',
      'Detective can investigate one player to learn if they are Mafia',
      'Godfather appears innocent when investigated (one-time immunity)',
    ],
  },
  {
    title: 'Day Phase',
    icon: '☀️',
    content: [
      'Night results are revealed',
      'Players discuss and debate who the Mafia might be',
      'Everyone votes to eliminate a suspect',
      'Majority vote eliminates that player and reveals their role',
    ],
  },
  {
    title: 'Roles',
    icon: '🎭',
    content: [
      'Villager — No special abilities, uses deduction to find Mafia',
      'Mafia — Kills at night, blends in during the day',
      'Godfather — Mafia leader, appears innocent to Detective once',
      'Doctor — Protects one player each night from being killed',
      'Detective — Investigates one player each night',
    ],
  },
]

export function RulesSection() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="py-16 px-4 bg-bg-primary">
      <div className="max-w-2xl mx-auto">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-bg-surface hover:bg-bg-elevated transition-colors rounded-2xl p-6 flex items-center justify-between group"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">📖</span>
            <div className="text-left">
              <h2 className="font-display text-2xl text-text-primary tracking-wide">
                HOW TO PLAY
              </h2>
              <p className="text-sm text-text-secondary">Rules & role abilities</p>
            </div>
          </div>
          <motion.span
            className="text-2xl text-text-secondary"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            ▼
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4">
                {rules.map((rule, index) => (
                  <motion.div
                    key={rule.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-bg-surface rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{rule.icon}</span>
                      <h3 className="font-semibold text-lg text-text-primary">{rule.title}</h3>
                    </div>
                    <ul className="space-y-2 ml-9">
                      {rule.content.map((item, i) => (
                        <li key={i} className="text-text-secondary text-sm flex items-start gap-2">
                          <span className="text-accent-neutral mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-accent-mafia/10 border border-accent-mafia/20 rounded-xl p-4 text-center"
                >
                  <p className="text-sm text-text-secondary">
                    <span className="text-accent-mafia font-medium">Pro tip:</span> Pay attention to
                    voice hesitations and defensive reactions — they often reveal more than words.
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
