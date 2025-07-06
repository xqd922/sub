'use client'

import React from 'react'
import Header from './layout/Header'
import SubscriptionForm from './features/subscription/SubscriptionForm'
import ConvertedLink from './features/subscription/ConvertedLink'
import ShortLinkGenerator from './features/subscription/ShortLinkGenerator'
import { useSubscription } from '../../lib/hooks/useSubscription'

/**
 * 主页内容组件
 * 整合所有子组件
 */
export default function HomeContent() {
  const {
    inputUrl,
    setInputUrl,
    loading,
    shortenLoading,
    error,
    convertedUrl,
    shortUrl,
    handleConvert,
    handleGenerateShortUrl,
    handleCopy
  } = useSubscription()

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800 flex items-start justify-center p-4 sm:p-6">
      <section className="w-full max-w-xl mt-24">
        <Header title="通用订阅转换" />

        <SubscriptionForm
          inputUrl={inputUrl}
          onInputChange={(e) => setInputUrl(e.target.value)}
          onConvert={handleConvert}
          loading={loading}
          error={error}
        />

        {convertedUrl && (
          <div className="space-y-4 mt-4">
            <ConvertedLink 
              url={convertedUrl} 
              onCopy={handleCopy} 
            />

            <ShortLinkGenerator
              shortUrl={shortUrl}
              isLoading={shortenLoading}
              onGenerate={handleGenerateShortUrl}
              onCopy={handleCopy}
            />
          </div>
        )}
      </section>
    </section>
  )
} 