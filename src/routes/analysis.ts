import { Hono } from 'hono';
import { Env } from '../types/env';
import { analyzeImage } from '../utils/imageAnalysis';
import { 
  getUnanalyzedEmojis, 
  saveAnalysisResult, 
  getAnalysisProgress,
  EmojiRecord,
  updateAllEmojiStats
} from '../services/database';

// Constants for batch processing
const BATCH_LIMITS = {
  MIN_BATCH_SIZE: 1,
  DEFAULT_BATCH_SIZE: 50,
  MAX_BATCH_SIZE: 200
} as const;

const app = new Hono<{ Bindings: Env }>();

// Helper function to validate batch size
function validateBatchSize(size: unknown): number {
  const batchSize = Number(size);
  
  if (isNaN(batchSize)) {
    return BATCH_LIMITS.DEFAULT_BATCH_SIZE;
  }
  
  if (batchSize < BATCH_LIMITS.MIN_BATCH_SIZE) {
    return BATCH_LIMITS.MIN_BATCH_SIZE;
  }
  
  if (batchSize > BATCH_LIMITS.MAX_BATCH_SIZE) {
    return BATCH_LIMITS.MAX_BATCH_SIZE;
  }
  
  return Math.floor(batchSize); // Ensure integer value
}

// Analyze a single emoji image
app.post('/analyze', async (c) => {
  const body = await c.req.json();
  const imageUrl = body.imageUrl;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return c.json({
      status: 'error',
      message: 'Invalid request: imageUrl is required'
    }, 400);
  }

  try {
    const analysis = await analyzeImage(c.env, imageUrl);
    return c.json({
      status: 'success',
      data: analysis
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, error instanceof Error && error.message.includes('Invalid') ? 400 : 500);
  }
});

// Batch analyze emoji images
app.post('/batch', async (c) => {
  const body = await c.req.json();
  const batchSize = validateBatchSize(body.batchSize);
  const { imageUrls } = body;

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return c.json({
      status: 'error',
      message: 'Invalid request: imageUrls array is required'
    }, 400);
  }

  if (imageUrls.length > batchSize) {
    return c.json({
      status: 'error',
      message: `Batch size limit exceeded. Maximum allowed: ${batchSize}`,
      limits: BATCH_LIMITS
    }, 400);
  }

  try {
    // Process images in parallel
    const analyses = await Promise.all(
      imageUrls.map(async (url: string) => {
        try {
          const analysis = await analyzeImage(c.env, url);
          return {
            imageUrl: url,
            status: 'success',
            data: analysis
          };
        } catch (error) {
          console.error(`Analysis failed for ${url}:`, error);
          return {
            imageUrl: url,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Calculate success rate
    const successCount = analyses.filter(result => result.status === 'success').length;
    const totalCount = analyses.length;

    return c.json({
      status: 'success',
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount,
        success_rate: `${((successCount / totalCount) * 100).toFixed(1)}%`,
        batch_size: batchSize
      },
      results: analyses
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

/**
 * Process local emojis and store analysis results
 * POST /process/local
 * Body: { 
 *   batchSize?: number, 
 *   lastProcessedId?: number,
 *   locale?: string 
 * }
 */
app.post('/process/local', async (c) => {
  const body = await c.req.json();
  const batchSize = validateBatchSize(body.batchSize);
  const { 
    lastProcessedId,
    locale = 'en' // default to English
  } = body;

  try {
    // Get unanalyzed emojis
    const emojis = await getUnanalyzedEmojis(c.env, batchSize, lastProcessedId);
    
    if (emojis.length === 0) {
      // Get overall progress when completed
      const progress = await getAnalysisProgress(c.env);
      return c.json({
        status: 'completed',
        message: 'No more emojis to analyze',
        progress,
        limits: BATCH_LIMITS
      });
    }

    // Process emojis in parallel
    const analyses = await Promise.all(
      emojis.map(async (emoji: EmojiRecord) => {
        try {
          // Analyze the image
          const analysis = await analyzeImage(c.env, emoji.image_url);
          
          // Save the results
          await saveAnalysisResult(c.env, emoji.slug, locale, analysis);
          
          return {
            slug: emoji.slug,
            status: 'success',
            data: analysis
          };
        } catch (error) {
          console.error(`Analysis failed for emoji ${emoji.slug}:`, error);
          return {
            slug: emoji.slug,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Calculate statistics
    const successCount = analyses.filter(result => result.status === 'success').length;
    const totalCount = analyses.length;
    const lastProcessedEmoji = emojis[emojis.length - 1];

    // Get current progress
    const progress = await getAnalysisProgress(c.env);

    return c.json({
      status: 'in_progress',
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount,
        success_rate: `${((successCount / totalCount) * 100).toFixed(1)}%`,
        last_processed_id: lastProcessedEmoji.id,
        batch_size: batchSize
      },
      progress,
      limits: BATCH_LIMITS,
      results: analyses
    });

  } catch (error) {
    console.error('Local processing error:', error);
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      last_processed_id: lastProcessedId,
      limits: BATCH_LIMITS
    }, 500);
  }
});

// Get current analysis progress
app.get('/progress', async (c) => {
  try {
    const progress = await getAnalysisProgress(c.env);
    return c.json({
      status: 'success',
      data: progress
    });
  } catch (error) {
    console.error('Progress check error:', error);
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

// 路由：更新所有统计数据
app.post('/update-stats', async (c) => {
  try {
    // 更新所有统计数据，不再区分 locale
    await updateAllEmojiStats(c.env);
    
    return c.json({
      success: true,
      message: "Successfully updated statistics globally"
    });
  } catch (error) {
    console.error('Error updating statistics:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app; 