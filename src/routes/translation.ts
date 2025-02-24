import { Hono } from 'hono';
import { Env } from '../types/env';
import { translateText } from '../utils/language';
import {
  getUntranslatedEmojis,
  batchInsertTranslations,
  getTranslationProgress
} from '../services/database';
const app = new Hono<{ Bindings: Env }>();

// Get translation progress for a specific locale
app.get('/progress/:locale', async (c) => {
  const locale = c.req.param('locale');
  const progress = await getTranslationProgress(c.env, locale);
  return c.json(progress);
});

// Start or continue batch translation for a specific locale
app.post('/batch/:locale', async (c) => {
  const locale = c.req.param('locale');
  const body = await c.req.json();
  const batchSize = body.batchSize || 50;
  const lastProcessedId = body.lastProcessedId || undefined;

  try {
    // Get untranslated emojis
    const emojis = await getUntranslatedEmojis(c.env, locale, batchSize, lastProcessedId);
    
    if (emojis.length === 0) {
      return c.json({
        status: 'completed',
        message: 'No more emojis to translate'
      });
    }

    // Translate prompts
    const translations = await Promise.all(
      emojis.map(async (emoji) => ({
        slug: emoji.slug,
        locale,
        translated_prompt: await translateText(c.env, emoji.prompt, locale)
      }))
    );

    // Save translations
    await batchInsertTranslations(c.env, translations);

    // Get updated progress
    const progress = await getTranslationProgress(c.env, locale);

    return c.json({
      status: 'in_progress',
      processed: translations.length,
      last_processed_id: emojis[emojis.length - 1].id,
      progress
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    return c.json({
      status: 'error',
      message: (error as Error).message,
      last_processed_id: lastProcessedId
    }, 500);
  }
});

export default app; 