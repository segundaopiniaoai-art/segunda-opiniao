type Props = {
  index: number
  children: React.ReactNode
  className?: string
}

export function AnimatedSection({ index, children, className }: Props) {
  return (
    <div
      className={className}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {children}
    </div>
  )
}
