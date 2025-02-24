const ALLOWED_ORIGINS = [
  'https://genmojionline.com',
  'https://www.genmojionline.com',
  'http://localhost:3000',
  'chrome-extension://' + 'lgkdchfgpkaigbnpcnginkdlahhdinki',
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

export function getCorsHeaders(origin: string | null): HeadersInit {
  if (!isAllowedOrigin(origin)) {
    throw new Error('Origin not allowed');
  }

  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
} 