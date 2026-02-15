const steps = [
  {
    number: 1,
    icon: '🎮',
    title: 'Create or Join',
    description:
      'Share a room code with friends. No accounts needed—just jump in and start talking.',
  },
  {
    number: 2,
    icon: '🎭',
    title: 'Get Your Role',
    description: 'Villager? Mafia? Doctor? Only you know the truth. Keep it secret.',
  },
  {
    number: 3,
    icon: '🗣️',
    title: 'Deceive or Detect',
    description: 'Talk, accuse, defend. Find the Mafia before they eliminate everyone.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-12 px-4 bg-bg-elevated">
      <h2 className="text-title font-bold text-center text-text-primary mb-8">How It Works</h2>

      <div className="flex flex-col gap-6 max-w-md mx-auto">
        {steps.map((step) => (
          <div
            key={step.number}
            className="bg-bg-surface rounded-xl p-6 flex flex-col items-center text-center"
          >
            <div className="text-display mb-2">{step.icon}</div>
            <div className="text-micro font-bold text-accent-neutral mb-1">Step {step.number}</div>
            <h3 className="text-headline font-semibold text-text-primary mb-2">{step.title}</h3>
            <p className="text-body text-text-secondary">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
