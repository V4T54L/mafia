import { useState } from 'react'

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
      'An ordinary citizen. No special powers, but your voice matters. Find the Mafia through discussion and deduction.',
  },
  {
    id: 'mafia',
    name: 'Mafia',
    team: 'mafia',
    icon: '💀',
    shortDesc: 'Eliminate the Town',
    fullDesc:
      'You know who your partners are. Each night, choose someone to eliminate. Blend in during the day.',
  },
  {
    id: 'detective',
    name: 'Detective',
    team: 'town',
    icon: '🔍',
    shortDesc: 'Investigate players',
    fullDesc:
      "Each night, investigate one player. Learn if they're Mafia... but can you share your findings without becoming a target?",
  },
  {
    id: 'doctor',
    name: 'Doctor',
    team: 'town',
    icon: '💊',
    shortDesc: 'Protect the innocent',
    fullDesc:
      'Each night, protect one player from elimination. Choose wisely—you might save a life, or waste your power.',
  },
  {
    id: 'godfather',
    name: 'Godfather',
    team: 'mafia',
    icon: '🎩',
    shortDesc: 'The hidden boss',
    fullDesc:
      'The boss. You appear innocent to the Detective... the first time. Use your cover wisely.',
  },
]

export function RolesSection() {
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  const toggleRole = (roleId: string) => {
    setExpandedRole(expandedRole === roleId ? null : roleId)
  }

  return (
    <section className="py-12 px-4 bg-bg-primary">
      <h2 className="text-title font-bold text-center text-text-primary mb-8">The Roles</h2>

      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto sm:grid-cols-3">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => toggleRole(role.id)}
            className={`
              p-4 rounded-xl text-center transition-all duration-200 cursor-pointer
              ${
                role.team === 'town'
                  ? 'bg-accent-town/10 border border-accent-town/30'
                  : 'bg-accent-mafia/10 border border-accent-mafia/30'
              }
              ${expandedRole === role.id ? 'ring-2 ring-accent-neutral' : ''}
              hover:scale-105
            `}
          >
            <div className="text-display mb-1">{role.icon}</div>
            <div className="text-caption font-semibold text-text-primary">{role.name}</div>
            <div
              className={`text-micro ${role.team === 'town' ? 'text-accent-town' : 'text-accent-mafia'}`}
            >
              {role.team === 'town' ? 'Town' : 'Mafia'}
            </div>
          </button>
        ))}
      </div>

      {/* Expanded role description */}
      {expandedRole && (
        <div className="mt-6 max-w-md mx-auto">
          {roles
            .filter((r) => r.id === expandedRole)
            .map((role) => (
              <div
                key={role.id}
                className={`
                  p-6 rounded-xl
                  ${role.team === 'town' ? 'bg-accent-town/10' : 'bg-accent-mafia/10'}
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-headline">{role.icon}</span>
                  <h3 className="text-headline font-semibold text-text-primary">{role.name}</h3>
                </div>
                <p className="text-body text-text-secondary">{role.fullDesc}</p>
              </div>
            ))}
        </div>
      )}

      <p className="text-center text-caption text-text-disabled mt-6">Tap a role to learn more</p>
    </section>
  )
}
