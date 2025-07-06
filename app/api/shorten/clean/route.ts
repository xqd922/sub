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
      } catch (err) {
        console.error(`删除失败 ${link.slug}:`, err);
      }
    }

    console.log(`\n成功删除 ${deletedCount}/${allLinks.length} 个短链接`);
    console.log('=== 清理完成 ===\n');

    return { 
      success: true,
      total: allLinks.length,
      deleted: deletedCount
    };

  } catch (err) {
    console.error('清理失败:', err);
    throw err;
  }
}

// POST 请求处理
export async function POST() {
  try {
    const result = await cleanLinks();
    
    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>短链接清理结果</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            min-height: 100vh;
            background: linear-gradient(to bottom right, #EEF2FF, #FFFFFF, #F3E8FF);
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            padding: 30px;
            background: rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(10px);
            text-align: center;
          }
          h1 {
            margin: 0 0 30px;
            font-size: 28px;
            font-weight: 300;
            background: linear-gradient(to right, #1f2937, #4b5563);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
          }
          .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
          }
          .stat-card {
            padding: 20px;
            background: rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(10px);
            border-radius: 12px;
          }
          .stat-value {
            font-size: 32px;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 8px;
          }
          .stat-label {
            font-size: 14px;
            color: #6b7280;
          }
          .success {
            padding: 12px;
            background: rgba(220, 252, 231, 0.7);
            color: #166534;
            backdrop-filter: blur(10px);
            border-radius: 12px;
          }
          .back {
            display: block;
            margin-top: 24px;
            color: #6b7280;
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s;
          }
          .back:hover {
            color: #374151;
          }
          @media (prefers-color-scheme: dark) {
            body {
              background: linear-gradient(to bottom right, #1f2937, #000000, #1f2937);
              color: #e5e7eb;
            }
            .container {
              background: rgba(0, 0, 0, 0.3);
            }
            h1 {
              background: linear-gradient(to right, #e5e7eb, #9ca3af);
              -webkit-background-clip: text;
            }
            .stat-card {
              background: rgba(0, 0, 0, 0.3);
            }
            .stat-value {
              color: #60a5fa;
            }
            .stat-label {
              color: #9ca3af;
            }
            .success {
              background: rgba(6, 78, 59, 0.7);
              color: #6ee7b7;
            }
            .back {
              color: #9ca3af;
            }
            .back:hover {
              color: #e5e7eb;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>短链接清理结果</h1>
          ${result.success ? 
            `<div class="success">清理成功</div>` : 
            `<div class="error">清理过程中出现错误</div>`
          }
          <div class="stats">
            <div class="stat-card">
              <div class="stat-value">${result.total}</div>
              <div class="stat-label">总链接数</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${result.deleted}</div>
              <div class="stat-label">已清理数量</div>
            </div>
          </div>
          <a href="/" class="back">返回首页</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (err) {
    console.error('API 错误:', err);
    return NextResponse.json(
      { error: '清理失败' },
      { status: 500 }
    );
  }
}

// GET 请求处理 - 显示初始页面
export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>清理短链接</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          background: linear-gradient(to bottom right, #EEF2FF, #FFFFFF, #F3E8FF);
          margin: 0;
          padding: 20px;
          color: #1f2937;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          padding: 30px;
          background: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(10px);
          text-align: center;
        }
        h1 {
          margin: 0 0 30px;
          font-size: 28px;
          font-weight: 300;
          background: linear-gradient(to right, #1f2937, #4b5563);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }
        .btn {
          display: inline-block;
          padding: 12px 28px;
          background: linear-gradient(to right, #1f2937, #4b5563);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
        }
        .btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .back {
          display: block;
          margin-top: 24px;
          color: #6b7280;
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }
        .back:hover {
          color: #374151;
        }
        @media (prefers-color-scheme: dark) {
          body {
            background: linear-gradient(to bottom right, #1f2937, #000000, #1f2937);
            color: #e5e7eb;
          }
          .container {
            background: rgba(0, 0, 0, 0.5);
          }
          h1 {
            background: linear-gradient(to right, #e5e7eb, #9ca3af);
            -webkit-background-clip: text;
          }
          .btn {
            background: linear-gradient(to right, #e5e7eb, #9ca3af);
            color: #1f2937;
          }
          .back {
            color: #9ca3af;
          }
          .back:hover {
            color: #e5e7eb;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>清理短链接</h1>
        <form method="POST">
          <button type="submit" class="btn">开始清理</button>
        </form>
        <a href="/" class="back">返回首页</a>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
} 