interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export default function UrlInput({ value, onChange, error }: UrlInputProps) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="在此输入你的订阅链接"
        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/50 dark:bg-black/50 backdrop-blur-sm border-0 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
      />
      {error && (
        <div className="text-[10px] sm:text-xs text-red-500/90 text-center">
          {error}
        </div>
      )}
    </div>
  )
}