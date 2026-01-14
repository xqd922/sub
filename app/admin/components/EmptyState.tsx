interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      {icon && (
        <div className="mb-4 text-default-300">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-default-600 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-default-400 max-w-md">
          {description}
        </p>
      )}
    </div>
  )
}
