import { NextResponse } from 'next/server'
import { getCustomClientRules } from '@/modules/record/client-rule.repository'
import {
  detectClientType,
  extractClientHeaders,
  parseShortLinkPathSegment,
} from '@/modules/renderer/client-detector'
import { resolveShortLinkDetailed } from '@/modules/short-link/short-link.repository'
import { generateShortLink } from '@/modules/short-link/short-link.service'
import { handleConversionRequest } from '@/modules/subscription/conversion.handler'
import { logger } from '@/server/logger'
import { getClientIp, parseJsonBody } from '@/server/route.utils'
import {
  isAllowedSubscriptionInput,
  isAutoManagedShortLinkName,
  unwrapConversionUrl,
} from '@/shared/url.utils'

function extractAccessKey(request: Request, incomingUrl: URL): string | null {
  const fromQuery =
    incomingUrl.searchParams.get('key') || incomingUrl.searchParams.get('pwd')
  if (fromQuery) return fromQuery.trim()

  const headerKey = request.headers.get('x-link-password')
  if (headerKey) return headerKey.trim()

  const auth = request.headers.get('authorization')
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim()
  }

  return null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderPasswordPromptHtml(linkName: string, wrongKey: boolean, target?: string): string {
  const safeName = escapeHtml(linkName)
  const hiddenTarget = target
    ? `<input type="hidden" name="target" value="${escapeHtml(target)}" />`
    : ''
  const errorNotice = wrongKey
    ? '<p class="err">密钥不正确，请重新输入</p>'
    : '<p class="hint">该订阅短链已开启密钥保护，验证后可预览或导入</p>'

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>密钥验证 · ${safeName}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #111; }
    @media (prefers-color-scheme: dark) { body { background: #111010; color: #f5f5f5; } .card { background: #181818; border-color: #2a2a2a; } input { background: #111010; border-color: #333; color: #f5f5f5; } button { background: #f5f5f5; color: #111; } }
    .card { width: 100%; max-width: 360px; padding: 24px; border-radius: 12px; border: 1px solid #e5e5e5; background: #fafafa; }
    h1 { margin: 0 0 6px; font-size: 18px; font-weight: 600; }
    .hint { margin: 0 0 16px; font-size: 13px; color: #737373; line-height: 1.5; }
    .err { margin: 0 0 16px; font-size: 13px; color: #dc2626; line-height: 1.5; }
    input { width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #d4d4d4; background: #fff; font-size: 14px; outline: none; }
    button { margin-top: 12px; width: 100%; height: 38px; border: 0; border-radius: 8px; background: #171717; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; }
  </style>
</head>
<body>
  <form class="card" method="GET">
    <h1>${safeName}</h1>
    ${errorNotice}
    ${hiddenTarget}
    <input type="password" name="key" placeholder="请输入访问密钥" required autofocus />
    <button type="submit">验证并访问</button>
  </form>
</body>
</html>`
}

export async function handleShortLinkRedirect(
  request: Request,
  rawId: string,
): Promise<NextResponse> {
  const { id, suffixTarget } = parseShortLinkPathSegment(rawId)
  if (!id || id.length < 2 || id.length > 64) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const incomingUrl = new URL(request.url)
    const incomingTarget = incomingUrl.searchParams.get('target')?.trim() || undefined
    const userAgent = request.headers.get('user-agent') || ''
    const customRules = await getCustomClientRules()
    const { clientType } = detectClientType(
      userAgent,
      incomingTarget || suffixTarget,
      extractClientHeaders(request.headers),
      customRules,
    )
    const accessKey = extractAccessKey(request, incomingUrl)
    const clientIp = getClientIp(request)

    const resolved = await resolveShortLinkDetailed(id, {
      key: accessKey,
      clientIp,
      clientType,
      userAgent,
    })

    if (resolved.status === 'not_found') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (resolved.status === 'disabled') {
      return NextResponse.json({ error: '该短链接已被禁用' }, { status: 403 })
    }

    if (resolved.status === 'expired') {
      return NextResponse.json({ error: '该短链接已过期' }, { status: 410 })
    }

    if (resolved.status === 'limit_reached') {
      return NextResponse.json({ error: '该短链接已达到最大访问次数上限' }, { status: 410 })
    }

    if (resolved.status === 'unauthorized') {
      if (clientType === 'browser') {
        return new NextResponse(
          renderPasswordPromptHtml(
            resolved.link.name,
            Boolean(accessKey),
            incomingTarget || suffixTarget || undefined,
          ),
          {
            status: 401,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        )
      }
      return NextResponse.json(
        { error: '该短链接受密钥保护，请在链接后附加 ?key=<密钥>' },
        { status: 401 },
      )
    }

    // 自动解包历史存储的 `/sub?url=...` 或绝对转换链接，避免二次包装造成自请求死循环
    const unwrapped = unwrapConversionUrl(resolved.link.targetUrl)
    const conversionUrl = new URL(incomingUrl.origin)
    conversionUrl.pathname = '/sub'
    conversionUrl.searchParams.set('url', unwrapped.subscriptionUrl)

    const linkDefaultTarget =
      resolved.link.defaultTarget && resolved.link.defaultTarget !== 'auto'
        ? resolved.link.defaultTarget
        : undefined
    const effectiveTarget = incomingTarget || suffixTarget || linkDefaultTarget || unwrapped.target
    if (effectiveTarget) {
      conversionUrl.searchParams.set('target', effectiveTarget)
    }

    const incomingName = incomingUrl.searchParams.get('name')?.trim()
    if (incomingName) {
      conversionUrl.searchParams.set('name', incomingName)
    }

    const forwardedHeaders = new Headers(request.headers)
    if (resolved.link.name && !isAutoManagedShortLinkName(resolved.link)) {
      forwardedHeaders.set('x-short-link-name', encodeURIComponent(resolved.link.name))
    }

    const forwardedRequest = new Request(conversionUrl.toString(), {
      method: 'GET',
      headers: forwardedHeaders,
    })

    return handleConversionRequest(forwardedRequest, { shortLink: resolved.link })
  } catch (error) {
    logger.error('[ShortLink] 跳转处理失败:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export async function handleShortenPost(request: Request): Promise<NextResponse> {
  const startedAt = Date.now()

  try {
    const body = await parseJsonBody<{ url?: string }>(request)
    const rawUrl = body?.url?.trim()
    if (!rawUrl) {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 })
    }

    const { subscriptionUrl } = unwrapConversionUrl(rawUrl)
    if (!isAllowedSubscriptionInput(subscriptionUrl)) {
      return NextResponse.json(
        { error: '仅支持有效的 HTTP(S) 订阅链接或代理节点 URI' },
        { status: 400 },
      )
    }

    const requestOrigin = new URL(request.url).origin
    logger.debug('开始处理短链接请求', { url: rawUrl })

    const result = await generateShortLink(rawUrl, requestOrigin)
    logger.debug('短链接生成成功', {
      provider: result.provider,
      shortUrl: result.shortUrl,
      duration: `${Date.now() - startedAt}ms`,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('短链接生成失败', {
      error: error instanceof Error ? error.message : '未知错误',
      duration: `${Date.now() - startedAt}ms`,
    })
    return NextResponse.json({ error: '短链接服务暂时不可用，请检查 KV 存储配置' }, { status: 503 })
  }
}

export async function handleShortenGet(request: Request): Promise<NextResponse> {
  const url = new URL(request.url).searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 })
  }

  return handleShortenPost(
    new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}
