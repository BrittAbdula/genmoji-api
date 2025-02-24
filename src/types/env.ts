import { VectorizeIndex } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  genmoji_images: R2Bucket;
  REPLICATE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_IMAGES_DELIVERY_URL: string;
  AI: any;
  VECTORIZE: VectorizeIndex;
  XAI_API_KEY: string;
} 

// Language mapping
const LANGUAGE_MAP: Record<string, { code: string; name: string }> = {
  'zh': { code: 'zh', name: 'Chinese (Simplified)' },
  'zh-TW': { code: 'zh', name: 'Chinese (Traditional)' },
  'en': { code: 'en', name: 'English' },
  'ja': { code: 'ja', name: 'Japanese' },
  'ko': { code: 'ko', name: 'Korean' },
  'es': { code: 'es', name: 'Spanish' },
  'fr': { code: 'fr', name: 'French' },
  'de': { code: 'de', name: 'German' },
  'it': { code: 'it', name: 'Italian' },
  'ru': { code: 'ru', name: 'Russian' },
  'pt': { code: 'pt', name: 'Portuguese' },
  'vi': { code: 'vi', name: 'Vietnamese' },
  'th': { code: 'th', name: 'Thai' },
  'id': { code: 'id', name: 'Indonesian' },
  'ms': { code: 'ms', name: 'Malay' },
  'ar': { code: 'ar', name: 'Arabic' },
  'hi': { code: 'hi', name: 'Hindi' }
};

export function getLanguageInfo(locale: string) {
  const langInfo = LANGUAGE_MAP[locale];
  if (!langInfo) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  return langInfo;
}
