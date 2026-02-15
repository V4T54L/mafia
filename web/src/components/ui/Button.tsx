import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-success text-bg-primary hover:bg-accent-success/90 active:bg-accent-success/80',
  secondary:
    'bg-bg-surface text-text-primary border border-bg-surface hover:bg-bg-elevated active:bg-bg-primary',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-surface',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm rounded-lg',
  md: 'h-12 px-6 text-base rounded-lg',
  lg: 'h-14 px-8 text-lg rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center
          font-semibold
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          cursor-pointer
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
