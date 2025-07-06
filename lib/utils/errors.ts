/**
 * 自定义错误类
 * 用于API错误处理
 */
export class SubscriptionError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

/**
 * API错误处理函数
 * @param error 捕获的错误
 * @returns Response对象
 */
export function handleApiError(error: unknown) {
  if (error instanceof SubscriptionError) {
    return new Response(error.message, { status: error.statusCode });
  }
  
  console.error('未处理的错误:', error);
  const message = error instanceof Error ? error.message : '服务器内部错误';
  return new Response(message, { status: 500 });
}

/**
 * 记录API请求日志
 * @param name API名称
 * @param fn 处理函数
 */
export function withLogging(name: string, fn: Function) {
  return async (...args: any[]) => {
    const startTime = Date.now();
    console.log(`\n=== 开始处理${name}请求 ===`);
    console.log('时间:', new Date().toLocaleString());
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      console.log(`\n=== 处理完成 ===`);
      console.log(`总耗时: ${duration}ms`);
      console.log('结束时间:', new Date().toLocaleString(), '\n');
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      console.error('\n=== 处理异常 ===');
      console.error('错误信息:', errorMessage);
      console.error(`总耗时: ${duration}ms`);
      console.error('结束时间:', new Date().toLocaleString(), '\n');
      
      throw error;
    }
  };
} 