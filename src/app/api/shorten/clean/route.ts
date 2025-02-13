import { NextResponse } from 'next/server';

// Sink 配置
const SINK_URL = process.env.SINK_URL || 'https://link.xqd.us.kg';
const SINK_TOKEN = process.env.SINK_TOKEN || 'x20030922';

export async function POST() {
  console.log('\n=== 开始清理短链接 ===');
  
  try {
    // 获取所有链接
    const response = await fetch(`${SINK_URL}/api/link/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SINK_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Host': new URL(SINK_URL).host
      },
      cache: 'no-store'
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
    console.log(`找到 ${links.length} 个短链接`);

    // 删除所有链接
    let deletedCount = 0;
    for (const link of links) {
      try {
        // 使用 PUT 方法删除
        const deleteResponse = await fetch(`${SINK_URL}/dashboard/api/links/${link.slug}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SINK_TOKEN}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Host': new URL(SINK_URL).host,
            'Origin': SINK_URL,
            'Referer': `${SINK_URL}/dashboard/links`
          },
          body: JSON.stringify({
            action: 'delete'
          }),
          cache: 'no-store'
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
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`删除失败 ${link.slug}:`, error);
      }
    }

    console.log(`\n成功删除 ${deletedCount}/${links.length} 个短链接`);
    console.log('=== 清理完成 ===\n');

    return NextResponse.json({ 
      success: true,
      total: links.length,
      deleted: deletedCount
    });

  } catch (error) {
    console.error('清理失败:', error);
    return NextResponse.json(
      { error: '清理失败' },
      { status: 500 }
    );
  }
} 