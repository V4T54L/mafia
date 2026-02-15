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
    description: 'No accounts. No downloads. No Discord. Share a code, start playing in seconds.',
  },
  {
    icon: '🤖',
    title: 'Auto-Moderated',
    description:
      'No human moderator needed. The game handles roles, timers, and rules. Everyone gets to play.',
  },
  {
    icon: '👻',
    title: 'Fair for the Dead',
    description:
      "Dead players listen but can't speak. No accidental leaks. No cheating. Just ghostly observation.",
  },
]

export function WhyMafiaSection() {
  return (
    <section className="py-12 px-4 bg-bg-primary">
      <h2 className="text-title font-bold text-center text-text-primary mb-8">Why Mafia?</h2>

      <div className="flex flex-col gap-4 max-w-md mx-auto">
        {features.map((feature) => (
          <div key={feature.title} className="bg-bg-surface rounded-xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-headline flex-shrink-0">{feature.icon}</span>
              <div>
                <h3 className="text-headline font-semibold text-text-primary mb-1">
                  {feature.title}
                </h3>
                <p className="text-body text-text-secondary">{feature.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
