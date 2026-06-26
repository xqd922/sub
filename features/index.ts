// 功能模块统一导出
export { handleRequest } from './convert/handler'
export { processSubscription, shouldFormatNames, formatProxies, logSubscriptionStats, type SubscriptionInfo } from './convert/processor'
export {
  generateClashConfig,
  generateSingboxConfig,
  generateV2rayNGConfig,
  generatePreviewHtml,
  detectClientType,
  generateResponseHeaders,
  logConfigStats,
} from './convert/builder'
export { fetchWithRetry, fetchSubscription, fetchRemoteNodes, fetchShortUrl, configure, getConfig, resetConfig, getStats, resetStats } from './metrics/network'
export { generate as generateShortLink } from './shorten/shortener'