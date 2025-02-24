export function createSlug(text: string, maxLength: number = 80): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, maxLength)
      .replace(/-+$/, ''); // 如果截断后末尾有连字符，去掉它
  } 
  
  
  // 修改 createSlug 函数，添加时间戳作为唯一标识符
  export function createUniqueSlug(baseSlug: string): string {
    const timestamp = Date.now().toString(36); // 将时间戳转换为36进制字符串
    const randomPart = Math.floor(Math.random() * 36 ** 4).toString(36); // 生成4位随机字符串
    return `${baseSlug}--${timestamp}${randomPart}`;
  }
  
  // 解析 slug 为 base slug 和 unique ID
  export function parseSlug(fullSlug: string) {
    const parts = fullSlug.split('--');
    return {
        baseSlug: parts[0],
        uniqueId: parts[1] || null
    };
  }

  export function getBaseSlug(slug: string): string {
    return slug.split('--')[0];
  }
  
  // 从 slug 推断 prompt
  export function inferPromptFromSlug(slug: string): string {
    const baseSlug = slug.split('--')[0];
    // 假设 createSlug 函数是用于将 prompt 转换为 slug 的
    // 我们需要一个反向函数来从 baseSlug 推断出 prompt
    // 这里假设 baseSlug 本身就是 prompt 的简化形式
    return baseSlug.replace(/-/g, ' '); // 将连字符替换为空格
  }