'use client'

import { useUrlConverter } from '../hooks/useUrlConverter'
import { useShortUrl } from '../hooks/useShortUrl'
import UrlInput from './ui/UrlInput'
import ResultItem from './ui/ResultItem'
import ShortUrlGenerator from './ui/ShortUrlGenerator'

export default function HomeContent() {
  const {
    inputUrl,
    setInputUrl,
    loading,
    error,
    convertedUrl,
    handleConvert,
    handleCopy
  } = useUrlConverter()

  const {
    shortUrl,
    shortenLoading,
    generateShortUrl,
    setShortUrl
  } = useShortUrl()

  const handleConvertClick = async () => {
    setShortUrl('') // 重置短链接
    await handleConvert()
  }

  const handleGenerateShortUrl = () => {
    generateShortUrl(convertedUrl)
  }

  const handleCopyShortUrl = () => {
    handleCopy(shortUrl)
  }

  const handleCopyConvertedUrl = () => {
    handleCopy(convertedUrl)
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800 flex items-start justify-center p-4 sm:p-6">
      <section className="w-full max-w-xl mt-24">
        <div className="text-center space-y-1 mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            通用订阅转换
          </h1>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <UrlInput
            value={inputUrl}
            onChange={setInputUrl}
            error={error}
          />

          <button
            onClick={handleConvertClick}
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

          {convertedUrl && (
            <div className="space-y-4">
              <ResultItem
                title="订阅链接"
                url={convertedUrl}
                onCopy={handleCopyConvertedUrl}
              />

              <ShortUrlGenerator
                hasConvertedUrl={!!convertedUrl}
                shortUrl={shortUrl}
                loading={shortenLoading}
                onGenerate={handleGenerateShortUrl}
                onCopy={handleCopyShortUrl}
              />
            </div>
          )}
        </div>
      </section>
    </section>
  )
} 