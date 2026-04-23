interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`subops-mark ${className}`} aria-hidden="true">
      <span className="subops-mark-ring" />
    </span>
  )
}
