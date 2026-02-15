import { motion } from 'framer-motion'

export function Footer() {
  return (
    <motion.footer
      className="py-8 px-4 bg-bg-elevated border-t border-bg-surface"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <div className="max-w-md mx-auto text-center">
        <div className="font-display text-2xl text-text-primary mb-2 tracking-wide">MAFIA</div>
        <p className="text-sm text-text-secondary mb-4">No moderator. No mercy.</p>
        <div className="flex justify-center gap-6 text-text-disabled">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors text-sm"
          >
            GitHub
          </a>
        </div>
        <p className="text-xs text-text-disabled mt-6">&copy; {new Date().getFullYear()}</p>
      </div>
    </motion.footer>
  )
}
