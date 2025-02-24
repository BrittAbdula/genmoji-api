import { Hono } from 'hono';
import { Env } from '../types/env';
import { ActionType, ReportReason, RatingDetails, ApiResponse } from '../types/emoji';
import * as db from '../services/database';

const app = new Hono<{ Bindings: Env }>();

// Toggle like
app.post('/:slug/like', async (c) => {
  try {
    const slug = c.req.param('slug');
    const userIp = c.req.header('cf-connecting-ip') || 'unknown';
    const { locale, user_id } = await c.req.json<{
      locale: string;
      user_id?: string;
    }>();

    // Check if emoji exists
    const emoji = await db.getEmojiBySlug(c.env, slug, locale);
    if (!emoji) {
      return c.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Emoji not found' 
      }, 404);
    }

    // Toggle like
    const { liked } = await db.toggleEmojiLike(c.env, slug, locale, userIp, user_id);
    
    return c.json<ApiResponse<{ liked: boolean; }>>({
      success: true,
      data: {
        liked,
      }
    });
  } catch (error) {
    console.error('Like toggle error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle like'
    }, 500);
  }
});

// Get like status
app.get('/:slug/like-status', async (c) => {
  try {
    const slug = c.req.param('slug');
    const userIp = c.req.header('cf-connecting-ip') || 'unknown';
    const userId = c.req.query('user_id');

    const liked = await db.getEmojiLikeStatus(c.env, slug, userIp, userId);

    return c.json<ApiResponse<{ liked: boolean }>>({
      success: true,
      data: {
        liked
      }
    });
  } catch (error) {
    console.error('Like status error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get like status'
    }, 500);
  }
});

// Record other actions (view, download, copy, report, share, upvote, downvote)
app.post('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const userIp = c.req.header('cf-connecting-ip') || 'unknown';
    
    const { action_type, locale, details } = await c.req.json<{
      action_type: ActionType;
      locale: string;
      details?: {
        reason?: ReportReason;
        description?: string;
        type?: 'link' | 'image' | 'prompt';
      };
    }>();

    if (!action_type) {
      return c.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Action type is required' 
      }, 400);
    }

    // Check if emoji exists
    const emoji = await db.getEmojiBySlug(c.env, slug, locale);
    if (!emoji) {
      return c.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Emoji not found' 
      }, 404);
    }

    // Record action
    await db.recordAction(c.env, {
      slug,
      locale,
      user_ip: userIp,
      action_type,
      action_details: details ? JSON.stringify(details) : undefined
    });

    // For reports, create a detailed report record
    if (action_type === 'report' && details?.reason) {
      await db.createReport(c.env, {
        slug,
        locale,
        reason: details.reason,
        details: details.description,
        status: 'pending'
      });
    }

    return c.json<ApiResponse<{ url?: string }>>({
      success: true,
      data: action_type === 'download' || action_type === 'copy' 
        ? { url: emoji.image_url }
        : undefined
    });
  } catch (error) {
    console.error('Action error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process action'
    }, 500);
  }
});

// Get emoji stats
app.get('/:slug/stats', async (c) => {
  try {
    const slug = c.req.param('slug');
    const locale = c.req.query('locale') || 'en';

    const stats = await db.getEmojiStats(c.env, slug);
    if (!stats) {
      return c.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Stats not found' 
      }, 404);
    }

    return c.json<ApiResponse<typeof stats>>({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json<ApiResponse<null>>({
      success: false,
      error: 'Failed to get stats'
    }, 500);
  }
});

export default app; 