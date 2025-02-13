import { NextResponse } from 'next/server';

// Sink 配置
const SINK_URL = process.env.SINK_URL || 'https://link.xqd.us.kg';
const SINK_TOKEN = process.env.SINK_TOKEN || 'x20030922';

// 清理短链接的主要逻辑
async function cleanLinks() {
  console.log('\n=== 开始清理短链接 ===');
  
  try {
    // 获取所有链接
    const allLinks = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${SINK_URL}/api/link/list?page=${page}&limit=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SINK_TOKEN}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('获取链接列表失败:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error('获取链接列表失败');
      }

      const data = await response.json();
      const links = data.links || [];
      allLinks.push(...links);

      // 如果返回的链接数小于请求的数量，说明没有更多了
      hasMore = links.length === 100;
      page++;

      console.log(`已获取 ${allLinks.length} 个短链接...`);
    }

    console.log(`共找到 ${allLinks.length} 个短链接`);

    // 删除所有链接
    let deletedCount = 0;
    for (const link of allLinks) {
      try {
        // 使用官方的删除 API
        const deleteResponse = await fetch(`${SINK_URL}/api/link/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SINK_TOKEN}`
          },
          body: JSON.stringify({
            slug: link.slug
          })
        });

        if (deleteResponse.ok) {
          deletedCount++;
          console.log(`已删除: ${link.slug}`);
        } else {
          const errorText = await deleteResponse.text();
          console.error(`删除失败 ${link.slug}:`, {
            status: deleteResponse.status,
            statusText: deleteResponse.statusText,
            body: errorText
          });
        }

        // 添加延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`删除失败 ${link.slug}:`, error);
      }
    }

    console.log(`\n成功删除 ${deletedCount}/${allLinks.length} 个短链接`);
    console.log('=== 清理完成 ===\n');

    return { 
      success: true,
      total: allLinks.length,
      deleted: deletedCount
    };

  } catch (error) {
    console.error('清理失败:', error);
    throw error;
  }
}

// POST 请求处理
export async function POST() {
  try {
    const result = await cleanLinks();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: '清理失败' },
      { status: 500 }
    );
  }
}

// GET 请求处理
export async function GET() {
  // 返回一个带有清理按钮的 HTML 页面
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>清理短链接</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 2rem auto;
            padding: 0 1rem;
            line-height: 1.5;
            text-align: center;
          }
          .success { color: #16a34a; }
          .error { color: #dc2626; }
          button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.5rem 1.5rem;
            border-radius: 0.5rem;
            font-size: 1rem;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          button:hover {
            opacity: 0.9;
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          #result {
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <h1>清理短链接</h1>
        <button onclick="cleanLinks()" id="cleanBtn">开始清理</button>
        <div id="result"></div>
        <p>
          <a href="/">返回首页</a>
        </p>

        <script>
          async function cleanLinks() {
            const btn = document.getElementById('cleanBtn');
            const result = document.getElementById('result');
            
            try {
              btn.disabled = true;
              btn.textContent = '清理中...';
              result.innerHTML = '';

              const response = await fetch('/api/shorten/clean', {
                method: 'POST'
              });
              
              const data = await response.json();
              
              if (response.ok) {
                result.innerHTML = \`
                  <p class="success">
                    清理完成！共删除 \${data.deleted}/\${data.total} 个短链接
                  </p>
                \`;
              } else {
                throw new Error(data.error || '清理失败');
              }
            } catch (error) {
              result.innerHTML = \`
                <p class="error">
                  \${error.message || '清理失败'}
                </p>
              \`;
            } finally {
              btn.disabled = false;
              btn.textContent = '开始清理';
            }
          }
        </script>
      </body>
    </html>
    `,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  );
} 