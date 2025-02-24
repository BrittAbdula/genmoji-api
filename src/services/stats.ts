import { Env } from '../types/env';
import { EmojiStats, ActionType, EmojiReport, Emoji } from '../types/emoji';



export async function getPopularEmojis(env: Env, limit: number, offset: number, locale: string): Promise<Emoji[]> {
  const result = await env.DB
    .prepare(`
      SELECT e.slug, e.prompt, e.image_url, e.translated_prompt, e.is_public, e.ip, e.locale, e.has_reference_image
      FROM emojis e
      JOIN emoji_stats s ON e.slug = s.slug AND e.locale = s.locale
      WHERE e.is_public = 1 AND e.locale = ?
      ORDER BY s.average_rating DESC, s.vote_count DESC, s.total_actions_count DESC
      LIMIT ? OFFSET ?
    `)
    .bind(locale, limit, offset)
    .all<Emoji>();

  return result.results;
}

export async function recordAction(
  env: Env,
  slug: string,
  locale: string,
  userIp: string,
  actionType: ActionType,
  userId?: string,
  details?: string
): Promise<void> {
  await env.DB
    .prepare(`
      INSERT INTO emoji_actions (
        slug,
        locale,
        user_id,
        user_ip,
        action_type,
        action_details,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      slug,
      locale,
      userId || null,
      userIp,
      actionType,
      details || null,
      new Date().toISOString()
    )
    .run();
}

export async function getUserAction(
  env: Env,
  slug: string,
  locale: string,
  userIp: string,
  actionType: ActionType,
  userId?: string
): Promise<boolean> {
  const query = userId 
    ? 'SELECT 1 FROM emoji_actions WHERE slug = ? AND locale = ? AND (user_id = ? OR user_ip = ?) AND action_type = ? LIMIT 1'
    : 'SELECT 1 FROM emoji_actions WHERE slug = ? AND locale = ? AND user_ip = ? AND action_type = ? LIMIT 1';
  
  const params = userId 
    ? [slug, locale, userId, userIp, actionType]
    : [slug, locale, userIp, actionType];

  const result = await env.DB
    .prepare(query)
    .bind(...params)
    .first<{ 1: number }>();

  return !!result;
}

export async function recordReport(
  env: Env,
  report: Omit<EmojiReport, 'id' | 'created_at' | 'status'>
): Promise<void> {
  const timestamp = new Date().toISOString();

  try {
    await env.DB.batch([
      // Insert report record
      env.DB.prepare(`
        INSERT INTO emoji_reports (
          slug, locale, user_id, reason, details, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).bind(report.slug, report.locale, report.user_id || null, report.reason, report.details || null, timestamp),

      // Record report action
      env.DB.prepare(`
        INSERT INTO emoji_actions (
          slug, locale, user_id, user_ip, action_type, action_details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(report.slug, report.locale, report.user_id || null, 'system', 'report', 
        JSON.stringify({ reason: report.reason, details: report.details }), timestamp)
    ]);
  } catch (error) {
    console.error('Failed to record report:', error);
    throw new Error('Failed to record report');
  }

  // Trigger async stats update
  try {
    await updateEmojiStats(env, report.slug, report.locale);
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to update stats after report:', error);
  }
}

// Batch update emoji stats
export async function batchUpdateStats(env: Env): Promise<void> {
  // Get all emojis that need stats update
  const emojis = await env.DB
    .prepare(`
      SELECT DISTINCT a.slug, a.locale
      FROM emoji_actions a
      LEFT JOIN emoji_stats s ON a.slug = s.slug AND a.locale = s.locale
      WHERE s.last_updated_at IS NULL
      OR s.last_updated_at < datetime('now', '-5 minutes')
      LIMIT 100
    `)
    .all<{ slug: string; locale: string }>();

  for (const emoji of emojis.results) {
    await updateEmojiStats(env, emoji.slug, emoji.locale);
  }
}

// Update stats for a single emoji
async function updateEmojiStats(env: Env, slug: string, locale: string): Promise<void> {
  const counts = await env.DB
    .prepare(`
      SELECT 
        COUNT(CASE WHEN action_type = 'view' THEN 1 END) as views_count,
        COUNT(CASE WHEN action_type = 'like' THEN 1 END) as likes_count,
        COUNT(CASE WHEN action_type = 'download' THEN 1 END) as downloads_count,
        COUNT(CASE WHEN action_type = 'copy' THEN 1 END) as copies_count,
        COUNT(CASE WHEN action_type = 'report' THEN 1 END) as reports_count,
        COUNT(CASE WHEN action_type = 'rate' THEN 1 END) as rating_count,
        SUM(CASE 
          WHEN action_type = 'rate' 
          THEN CAST(JSON_EXTRACT(action_details, '$.score') AS INTEGER)
          ELSE 0 
        END) as total_rating,
        COUNT(*) as total_actions_count,
        AVG(CASE 
          WHEN action_type = 'like' THEN 1
          WHEN action_type = 'report' THEN 0
          ELSE NULL 
        END) as average_rating,
        COUNT(CASE 
          WHEN action_type IN ('like', 'report') THEN 1 
        END) as vote_count
      FROM emoji_actions 
      WHERE slug = ? AND locale = ?
    `)
    .bind(slug, locale)
    .first<{
      views_count: number;
      likes_count: number;
      downloads_count: number;
      copies_count: number;
      reports_count: number;
      rating_count: number;
      total_rating: number;
      total_actions_count: number;
      average_rating: number;
      vote_count: number;
    }>();

  if (!counts) return;

  // Calculate average rating
  const calculatedAverageRating = counts.rating_count > 0 
    ? counts.total_rating / counts.rating_count 
    : 0;

  // Insert or update stats
  await env.DB
    .prepare(`
      INSERT INTO emoji_stats (
        slug,
        locale,
        views_count,
        likes_count,
        downloads_count,
        copies_count,
        reports_count,
        rating_count,
        total_rating,
        average_rating,
        vote_count,
        total_actions_count,
        last_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug, locale) DO UPDATE SET
        views_count = excluded.views_count,
        likes_count = excluded.likes_count,
        downloads_count = excluded.downloads_count,
        copies_count = excluded.copies_count,
        reports_count = excluded.reports_count,
        rating_count = excluded.rating_count,
        total_rating = excluded.total_rating,
        average_rating = excluded.average_rating,
        vote_count = excluded.vote_count,
        total_actions_count = excluded.total_actions_count,
        last_updated_at = excluded.last_updated_at
    `)
    .bind(
      slug,
      locale,
      counts.views_count,
      counts.likes_count,
      counts.downloads_count,
      counts.copies_count,
      counts.reports_count,
      counts.rating_count,
      counts.total_rating,
      calculatedAverageRating,
      counts.vote_count,
      counts.total_actions_count,
      new Date().toISOString()
    )
    .run();
}

// Get emoji stats
export async function getEmojiStats(env: Env, slug: string, locale: string): Promise<EmojiStats | null> {
  return env.DB
    .prepare('SELECT * FROM emoji_stats WHERE slug = ? AND locale = ?')
    .bind(slug, locale)
    .first<EmojiStats>();
} 