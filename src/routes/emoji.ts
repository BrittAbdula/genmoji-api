import { Hono } from 'hono';
import { Env } from '../types/env';
import { Emoji } from '../types/emoji';
import { isEnglish, translateText } from '../utils/language';
import { createSlug, createUniqueSlug } from '../utils/slug';
import * as db from '../services/database';
import * as ai from '../services/ai';
import * as cloudflare from '../services/cloudflare';
import * as vectorize from '../services/vectorize';

const app = new Hono<{ Bindings: Env }>();

// Get emoji by slug
app.get('/by-slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const locale = c.req.query('locale') || 'en';
  // console.log('---> get /emoji/by-slug:', slug, locale);

  const emoji = await db.getEmojiBySlug(c.env, slug, locale);
  if (!emoji) {
    return c.json({ success: false, error: 'Emoji not found' }, 404);
  }

  return c.json({ success: true, emoji });
});

// Get emojis by base slug
app.get('/by-base-slug/:baseSlug', async (c) => {
  const baseSlug = c.req.param('baseSlug');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const emojis = await db.getEmojisByBaseSlug(c.env, baseSlug, limit, offset);

  if (emojis.length === 0) {
    return c.json({ success: true, emojis: [] });
  }

  return c.json({ success: true, emojis });
});

// Get related emojis
app.get('/related/:slug', async (c) => {
  const slug = c.req.param('slug');
  const locale = c.req.query('locale') || 'en';
  const limit = Math.min(parseInt(c.req.query('limit') || '6'), 30);
  // console.log('---> get /emoji/related:', slug, locale);

  const emoji = await c.env.DB
    .prepare('SELECT * FROM emojis WHERE slug = ?')
    .bind(slug)
    .first<Emoji>();

  if (!emoji) {
    return c.json({ success: false, error: 'Emoji not found' }, 404);
  }

  const relatedEmojis = await vectorize.searchEmojisByVector(
    c.env,
    emoji.prompt,
    limit,
    0,
    emoji.id?.toString(),
    locale
  );

  return c.json({ success: true, emojis: relatedEmojis });
});

// List emojis with pagination and sorting
app.get('/list', async (c) => {
  const locale = c.req.query('locale') || 'en';
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 50);
  const offset = parseInt(c.req.query('offset') || '0');
  const sort = (c.req.query('sort') || 'latest') as 'latest' | 'popular' | 'quality';
  
  // 新增查询参数
  const model = c.req.query('model');
  const category = c.req.query('category');
  const color = c.req.query('color');

  const emojis = await db.listEmojis(c.env, {
    limit,
    offset,
    sort,
    locale,
    model,
    category,
    color
  });
  
  return c.json({ success: true, emojis });
});

// Search emojis
app.get('/search', async (c) => {
  const query = c.req.query('q');
  // console.log('---> get /emoji/search:', query);
  if (!query) {
    return c.json({ success: false, error: 'Search query is required' }, 400);
  }

  const locale = c.req.query('locale') || 'en';
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const emojis = await vectorize.searchEmojisByVector(c.env, query, limit, offset, undefined, locale);
  return c.json({ success: true, emojis });
});

// Generate new emoji
app.post('/generate', async (c) => {
  try {
    const { prompt, image, locale = 'en', model = 'gemoji' } = await c.req.json<{
      prompt: string;
      locale?: string;
      image?: string;
      model?: string | 'gemoji' | 'sticker' | 'mascot';
    }>();
    if (!prompt.trim()) {
      return c.json({ success: false, error: 'Prompt is required' }, 400);
    }

    if (prompt.length > 280) {
      return c.json({ success: false, error: 'Prompt is too long' }, 400);
    }

    let translatedPrompt = prompt.trim();

    if (!isEnglish(translatedPrompt)) {
      try {
        translatedPrompt = await translateText(c.env, prompt, 'en');
      } catch (error) {
        return c.json({ success: false, error: 'Translation failed' }, 500);
      }
    }

    const baseSlug = createSlug(translatedPrompt);
    let slug = baseSlug;

    const existing = await db.getEmojiBySlug(c.env, slug, locale);
    if (existing) {
      slug = createUniqueSlug(baseSlug);
    }
    // console.log('---> baseSlug:', baseSlug, 'slug:', slug);

    // Generate emoji
    const predictionUrl = await ai.generateEmoji(c.env, translatedPrompt, image, model);
    const imageUrl = await ai.pollPrediction(predictionUrl, c.env, 30, 6000, model);
    let processedImageUrl = imageUrl;
    if (model !== 'sticker') {
      // Remove background
      const removeBgUrl = await ai.removeBackground(c.env, imageUrl);
      processedImageUrl = await ai.pollPrediction(removeBgUrl, c.env, 15);
    }

    // Upload to Cloudflare Images
    const finalImageUrl = await cloudflare.uploadToCloudflareImages(c.env, processedImageUrl);
    // Store in database
    const userIp = c.req.header('cf-connecting-ip') || 'unknown';
    const emojiData: Omit<Emoji, 'id' | 'created_at'> = {
      slug,
      base_slug: baseSlug,
      prompt: translatedPrompt,
      original_prompt: prompt,
      image_url: finalImageUrl,
      is_public: true,
      ip: userIp,
      locale,
      has_reference_image: image ? true : false,
      model
    };

    const id = await db.insertEmoji(c.env, emojiData);

    // Only store vector and translations if this is a new unique emoji (baseSlug === slug)
    if (baseSlug === slug) {
      c.executionCtx.waitUntil(
        Promise.all([
          vectorize.storeEmojiVector(c.env, {
            ...emojiData,
            id,
            created_at: new Date().toISOString()
          }).catch((err: Error) => console.error('Failed to store vector:', err)),

          // Translate to other languages
          db.translateAndStoreMultiLang(c.env, baseSlug, prompt, [
            'zh', 'ja', 'fr'
          ]).catch((err: Error) => console.error('Failed to store translations:', err)),

          // analyze emoji
          ai.analyzeEmoji(c.env, {
            ...emojiData,
            id,
            created_at: new Date().toISOString()
          }).catch((err: Error) => console.error('Failed to analyze emoji:', err))
        ])
      );
    }

    return c.json({
      success: true,
      emoji: {
        prompt: translatedPrompt,
        slug,
        image_url: finalImageUrl,
        original_prompt: prompt,
        has_reference_image: image ? true : false,
        locale,
        model
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, 500);
  }
});

// 新增路由：获取分组数据
app.get('/groups', async (c) => {
  const locale = c.req.query('locale') || 'en';
  
  try {
    // 获取分组数据
    const groups = await db.getEmojiGroups(c.env, locale);
    return c.json({ 
      success: true, 
      data: groups 
    });
  } catch (error) {
    console.error('Error fetching emoji groups:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch emoji groups' 
    }, 500);
  }
});

export default app; 