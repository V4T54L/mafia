export function Footer() {
  return (
    <footer className="py-6 px-4 bg-bg-elevated border-t border-bg-surface">
      <div className="max-w-md mx-auto text-center">
        <div className="text-headline font-bold text-text-primary mb-2">MAFIA</div>
        <p className="text-caption text-text-secondary mb-4">No moderator. No mercy.</p>
        <div className="flex justify-center gap-6 text-text-disabled">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors"
          >
            GitHub
          </a>
        </div>
        <p className="text-micro text-text-disabled mt-6">&copy; {new Date().getFullYear()}</p>
      </div>
    </footer>
  )
}
