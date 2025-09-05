interface ConvertButtonProps {
  onClick: () => void
  loading: boolean
}

export default function ConvertButton({ onClick, loading }: ConvertButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative w-full py-2.5 sm:py-3 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl disabled:opacity-50 transition-all hover:opacity-90 hover:shadow-lg hover:shadow-gray-500/10 overflow-hidden"
    >
      {loading && (
        <div className="absolute inset-0 w-full h-full">
          <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 animate-progress-indeterminate"></div>
        </div>
      )}
      <div className="relative">
        {loading ? '转换中...' : '转换'}
      </div>
    </button>
  )
}