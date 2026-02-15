import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Role {
  id: string
  name: string
  team: 'town' | 'mafia'
  icon: string
  shortDesc: string
  fullDesc: string
}

const roles: Role[] = [
  {
    id: 'villager',
    name: 'Villager',
    team: 'town',
    icon: '👤',
    shortDesc: 'Find the Mafia',
    fullDesc:
      'No powers. Just your instincts. Listen closely, ask the right questions, and pray you trust the right people.',
  },
  {
    id: 'mafia',
    name: 'Mafia',
    team: 'mafia',
    icon: '💀',
    shortDesc: 'Eliminate the Town',
    fullDesc:
      'You know your partners. They know you. Every night, choose someone to silence. Every day, act innocent.',
  },
  {
    id: 'detective',
    name: 'Detective',
    team: 'town',
    icon: '🔍',
    shortDesc: 'Investigate players',
    fullDesc:
      'Each night, learn one truth. But sharing it makes you a target. How do you reveal what you know without dying for it?',
  },
  {
    id: 'doctor',
    name: 'Doctor',
    team: 'town',
    icon: '💊',
    shortDesc: 'Protect the innocent',
    fullDesc:
      'One save per night. Choose wrong, and someone dies. Choose right, and you might just turn the game.',
  },
  {
    id: 'godfather',
    name: 'Godfather',
    team: 'mafia',
    icon: '🎩',
    shortDesc: 'The hidden boss',
    fullDesc:
      "The Detective checks you? You're clean. The first time. After that, your cover is blown. Use your one free pass wisely.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

export function RolesSection() {
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  const toggleRole = (roleId: string) => {
    setExpandedRole(expandedRole === roleId ? null : roleId)
  }

  return (
    <section className="py-20 px-4 bg-bg-primary">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <h2 className="font-display text-4xl md:text-5xl text-center text-text-primary mb-12 tracking-wide">
          THE ROLES
        </h2>
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-3 max-w-md mx-auto sm:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
      >
        {roles.map((role) => (
          <motion.button
            key={role.id}
            variants={itemVariants}
            onClick={() => toggleRole(role.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className={`
              p-4 rounded-2xl text-center transition-colors duration-200 cursor-pointer
              ${
                role.team === 'town'
                  ? 'bg-accent-town/10 border border-accent-town/30 hover:bg-accent-town/20'
                  : 'bg-accent-mafia/10 border border-accent-mafia/30 hover:bg-accent-mafia/20'
              }
              ${expandedRole === role.id ? 'ring-2 ring-accent-neutral ring-offset-2 ring-offset-bg-primary' : ''}
            `}
          >
            <div className="text-4xl mb-2">{role.icon}</div>
            <div className="text-sm font-semibold text-text-primary">{role.name}</div>
            <div
              className={`text-xs mt-1 ${role.team === 'town' ? 'text-accent-town' : 'text-accent-mafia'}`}
            >
              {role.team === 'town' ? 'Town' : 'Mafia'}
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Expanded role description */}
      <AnimatePresence mode="wait">
        {expandedRole && (
          <motion.div
            key={expandedRole}
            className="mt-6 max-w-md mx-auto"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {roles
              .filter((r) => r.id === expandedRole)
              .map((role) => (
                <div
                  key={role.id}
                  className={`
                    p-5 rounded-2xl
                    ${role.team === 'town' ? 'bg-accent-town/10 border border-accent-town/20' : 'bg-accent-mafia/10 border border-accent-mafia/20'}
                  `}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{role.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{role.name}</h3>
                      <span
                        className={`text-xs ${role.team === 'town' ? 'text-accent-town' : 'text-accent-mafia'}`}
                      >
                        {role.team === 'town' ? 'Town' : 'Mafia'}
                      </span>
                    </div>
                  </div>
                  <p className="text-body text-text-secondary leading-relaxed">{role.fullDesc}</p>
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.p
        className="text-center text-sm text-text-disabled mt-8"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        viewport={{ once: true }}
      >
        Tap a role to learn more
      </motion.p>
    </section>
  )
}
