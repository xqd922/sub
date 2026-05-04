import { getCloudflareContext } from '@opennextjs/cloudflare'

interface SubOpsCloudflareEnv extends CloudflareEnv {
  LINKS_KV?: KVNamespace
}

export interface SubOpsCloudflareRuntime {
  env: SubOpsCloudflareEnv
  ctx: ExecutionContext
}

export function getCloudflareRuntime(): SubOpsCloudflareRuntime | null {
  try {
    const context = getCloudflareContext()
    return {
      env: context.env as SubOpsCloudflareEnv,
      ctx: context.ctx
    }
  } catch {
    return null
  }
}
