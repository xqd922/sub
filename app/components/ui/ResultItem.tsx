interface ResultItemProps {
  title: string
  url: string
  onCopy: () => void
}

export default function ResultItem({ title, url, onCopy }: ResultItemProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-xs text-gray-400">{title}</span>
        <button
          onClick={onCopy}
          className="text-[10px] sm:text-xs text-blue-500/80 hover:text-blue-600 transition-colors"
        >
          复制
        </button>
      </div>
      <div className="p-2.5 sm:p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg text-[10px] sm:text-xs font-mono break-all border border-gray-200/50 dark:border-gray-700/50">
        {url}
      </div>
    </div>
  )
}