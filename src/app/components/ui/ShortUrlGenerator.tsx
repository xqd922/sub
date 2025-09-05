interface ShortUrlGeneratorProps {
  hasConvertedUrl: boolean
  shortUrl: string
  loading: boolean
  onGenerate: () => void
  onCopy: () => void
}

export default function ShortUrlGenerator({ 
  hasConvertedUrl, 
  shortUrl, 
  loading, 
  onGenerate, 
  onCopy 
}: ShortUrlGeneratorProps) {
  if (!hasConvertedUrl) return null

  if (!shortUrl) {
    return (
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-xs text-gray-400">短链接</span>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="text-[10px] sm:text-xs text-blue-500/80 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
        >
          {loading ? '生成中...' : '生成短链接'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-xs text-gray-400">短链接</span>
        <button
          onClick={onCopy}
          className="text-[10px] sm:text-xs text-blue-500/80 hover:text-blue-600 transition-colors"
        >
          复制
        </button>
      </div>
      <div className="p-2.5 sm:p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg text-[10px] sm:text-xs font-mono break-all border border-gray-200/50 dark:border-gray-700/50">
        {shortUrl}
      </div>
    </div>
  )
}