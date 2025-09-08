import { NextResponse } from 'next/server'
import { ShortService } from '@/services'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const result = await ShortService.cleanAll()
    
    const html = generateResultHtml(result, true)
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '清理失败'
    const html = generateResultHtml({ total: 0, deleted: 0 }, false, errorMessage)
    
    return new NextResponse(html, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}

export async function GET() {
  const html = generateInitialHtml()
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function generateResultHtml(result: { total: number; deleted: number }, success: boolean, error?: string) {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>短链接清理结果</title>
      ${getStyles()}
    </head>
    <body>
      <div class="container">
        <h1>短链接清理结果</h1>
        ${success 
          ? '<div class="success">清理成功</div>' 
          : `<div class="error">${error || '清理过程中出现错误'}</div>`
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
  `
}

function generateInitialHtml() {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>清理短链接</title>
      ${getStyles()}
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
  `
}

function getStyles() {
  return `
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
        border-radius: 12px;
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
        border-radius: 12px;
        margin-bottom: 20px;
      }
      .error {
        padding: 12px;
        background: rgba(254, 226, 226, 0.7);
        color: #991b1b;
        border-radius: 12px;
        margin-bottom: 20px;
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
    </style>
  `
} 