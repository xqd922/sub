export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Clash 订阅转换
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-sm text-gray-500">API 运行正常</p>
          </div>
        </div>

        <div className="space-y-8 text-left">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">使用方法</h2>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">API 端点</h3>
              <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded">
                GET /sub?url=订阅链接
              </code>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">支持格式</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li>Shadowsocks (SS)</li>
              <li>VMess</li>
              <li>Trojan</li>
              <li>Clash</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">示例</h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">使用 curl 请求:</p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
{`curl "https://subapi.xqd.us.kg/sub?url=你的订阅链接"`}
              </pre>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">客户端配置</h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                在 Clash 客户端中添加以下订阅地址:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto break-all">
{`https://subapi.xqd.us.kg/sub?url=你的订阅链接`}
              </pre>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">注意事项</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
              <li>订阅链接需要 URL 编码</li>
              <li>支持批量转换多个订阅链接，使用 | 分隔</li>
              <li>转换后配置包含我自己书写的分流规则</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
