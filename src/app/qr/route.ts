import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return new NextResponse('Missing URL parameter', { status: 400 })
    }

    const qrCode = await QRCode.toDataURL(url, {
      type: 'image/png',
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>订阅二维码</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f5f5f5;
            font-family: system-ui, sans-serif;
          }
          .qr-container {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .qr-container img {
            max-width: 200px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          .qr-container p {
            margin: 15px 0 0;
            color: #666;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #1a1a1a }
            .qr-container {
              background: #2d2d2d;
            }
            .qr-container p {
              color: #aaa;
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <img src="${qrCode}" alt="订阅二维码">
          <p>扫描二维码导入配置</p>
        </div>
      </body>
      </html>
      `,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      }
    )
  } catch (error) {
    console.error('生成二维码失败:', error)
    return new NextResponse('生成二维码失败', { status: 500 })
  }
} 