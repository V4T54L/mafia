export function GameLoopSection() {
  return (
    <section className="py-12 px-4 bg-bg-elevated">
      <h2 className="text-title font-bold text-center text-text-primary mb-8">The Game Loop</h2>

      <div className="max-w-md mx-auto flex flex-col gap-6">
        {/* Night Phase */}
        <div className="bg-bg-primary rounded-xl p-6 border border-accent-neutral/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-display">🌙</span>
            <h3 className="text-headline font-semibold text-text-primary">Night</h3>
          </div>
          <p className="text-body text-text-secondary">
            The town sleeps. Mafia secretly chooses a victim. The Doctor protects. The Detective
            investigates. When dawn breaks, someone might be gone.
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <svg
            className="w-6 h-6 text-text-disabled"
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
        </div>

        {/* Day Phase */}
        <div className="bg-bg-primary rounded-xl p-6 border border-accent-warning/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-display">☀️</span>
            <h3 className="text-headline font-semibold text-text-primary">Day</h3>
          </div>
          <p className="text-body text-text-secondary">
            Everyone wakes up. Discuss, argue, accuse. Vote on who to eliminate. But be careful—the
            Mafia is among you, pointing fingers too.
          </p>
        </div>

        {/* Arrow loop */}
        <div className="flex justify-center">
          <svg
            className="w-6 h-6 text-text-disabled"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>

        {/* Win Conditions */}
        <div className="text-center text-caption text-text-secondary">
          <p className="mb-1">
            <span className="text-accent-town font-semibold">Town wins:</span> Eliminate all Mafia
          </p>
          <p>
            <span className="text-accent-mafia font-semibold">Mafia wins:</span> Equal or outnumber
            the Town
          </p>
        </div>
      </div>
    </section>
  )
}
