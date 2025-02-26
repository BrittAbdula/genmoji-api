import { Env } from '../types/env';
import {
  Emoji,
  EmojiDetails,
  EmojiStats,
  EmojiReport,
  EmojiAction,
  ActionType
} from '../types/emoji';
import { translateToMultipleLanguages } from '../utils/language';
import { ImageAnalysisResult } from '../utils/imageAnalysis';

const SELECT_FIELDS = 'prompt, slug, image_url, created_at, is_public, likes_count, dislikes_count, downloads_count, copies_count, discord_adds_count, locale';

// Internal helper to get emoji ID by slug and locale
async function getEmojiId(env: Env, slug: string, locale: string): Promise<number | null> {
  const result = await env.DB
    .prepare('SELECT id FROM emojis WHERE slug = ? AND locale = ?')
    .bind(slug, locale)
    .first<{ id: number }>();

  return result?.id || null;
}

// Emoji base operations
export async function insertEmoji(env: Env, emoji: Omit<Emoji, 'id' | 'created_at'>): Promise<number> {

  const result = await env.DB
    .prepare(
      'INSERT INTO emojis (prompt, base_slug, slug, image_url, original_prompt, ip, has_reference_image, is_public, locale, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
    )
    .bind(
      emoji.prompt,
      emoji.base_slug,
      emoji.slug,
      emoji.image_url,
      emoji.original_prompt,
      emoji.ip,
      emoji.has_reference_image,
      emoji.is_public,
      emoji.locale,
      emoji.model
    )
    .first<{ id: number }>();

  return result?.id || 0;
}

export async function getEmojiBySlug(env: Env, slug: string, locale: string): Promise<Emoji | null> {
  const result = await env.DB
  .prepare(`
  SELECT 
    e.id, 
    e.slug, 
    e.image_url, 
    e.created_at, 
    e.is_public, 
    e.ip, 
    e.has_reference_image,
    COALESCE(et.translated_prompt, e.original_prompt) as prompt,
    e.model,
    ed.category,
    ed.primary_color,
    ed.quality_score,
    ed.subject_count,
    ed.keywords
  FROM emojis e
  LEFT JOIN emoji_translations et ON e.base_slug = et.base_slug AND et.locale = ?
  LEFT JOIN emoji_details ed ON e.slug = ed.slug 
  WHERE e.slug = ?
`)
  .bind(locale, slug)
  .first<Emoji>();

  return result;
}

// get emojis by base slug
export async function getEmojisByBaseSlug(
  env: Env, 
  baseSlug: string,
  limit: number = 20,
  offset: number = 0
): Promise<Emoji[]> {
  const result = await env.DB
    .prepare(`
      SELECT * FROM emojis e 
      WHERE base_slug = ? AND has_reference_image = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(baseSlug, limit, offset) 
    .all<Emoji>();

  return result.results;
}

export async function listEmojis(
  env: Env,
  limit: number,
  offset: number,
  sort: 'latest' | 'popular',
  locale: string
): Promise<Emoji[]> {
  let query = `
    SELECT 
      e.id, 
      e.slug, 
      e.image_url, 
      e.created_at, 
      e.is_public, 
      e.ip, 
      e.has_reference_image,
      COALESCE(et.translated_prompt, e.original_prompt) as prompt,
      e.model
    FROM emojis e 
    LEFT JOIN emoji_translations et 
      ON e.base_slug = et.base_slug 
      AND et.locale = ?
  `;

  if (sort === 'popular') {
    query += ' LEFT JOIN emoji_stats s ON e.slug = s.slug';
    query += ' WHERE e.is_public = 1 AND e.has_reference_image = 0';
    query += ' ORDER BY s.average_rating DESC, s.vote_count DESC, e.created_at DESC';
  } else {
    query += ' WHERE e.is_public = 1 AND e.has_reference_image = 0';
    query += ' ORDER BY e.created_at DESC';
  }
  query += ' LIMIT ? OFFSET ?';

  const results = await env.DB
    .prepare(query)
    .bind(locale, limit, offset)
    .all<Emoji>();

  return results.results;
}

// Emoji details operations
export async function insertEmojiDetails(env: Env, details: Omit<EmojiDetails, 'id'>): Promise<void> {
  await env.DB
    .prepare(
      'INSERT INTO emoji_details (slug, locale, category, primary_color, keywords, quality_score) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      details.slug,
      details.locale,
      details.category,
      details.primary_color,
      details.keywords,
      details.quality_score
    )
    .run();
}

export async function getEmojiDetails(env: Env, slug: string, locale: string): Promise<EmojiDetails | null> {
  return env.DB
    .prepare('SELECT * FROM emoji_details WHERE slug = ? AND locale = ?')
    .bind(slug, locale)
    .first<EmojiDetails>();
}

// Stats operations
export async function initEmojiStats(env: Env, slug: string): Promise<void> {
  await env.DB
    .prepare(
      'INSERT INTO emoji_stats (slug, last_updated_at) VALUES (?, ?, ?)'
    )
    .bind(
      slug,
      new Date().toISOString()
    )
    .run();
}

export async function getEmojiStats(env: Env, slug: string): Promise<EmojiStats | null> {
  return env.DB
    .prepare('SELECT * FROM emoji_stats WHERE slug = ?')
    .bind(slug)
    .first<EmojiStats>();
}

// Action operations
export async function recordAction(
  env: Env,
  action: Omit<EmojiAction, 'id' | 'created_at'>
): Promise<void> {
  try {
    await env.DB
      .prepare(`
        INSERT INTO emoji_actions (
          slug,
          locale,
          user_id,
          user_ip,
          action_type,
          action_details
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        action.slug,
        action.locale,
        action.user_id || null,
        action.user_ip,
        action.action_type,
        action.action_details || null
      )
      .run();
  } catch (error) {
    console.error('Record action error:', error);
    throw new Error(`Failed to record action: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getUserAction(
  env: Env,
  slug: string,
  locale: string,
  userIp: string,
  actionType: ActionType,
  userId?: string
): Promise<boolean> {
  // Build query based on whether userId is provided
  const query = userId
    ? 'SELECT 1 FROM emoji_actions WHERE slug = ? AND locale = ? AND user_id = ? AND action_type = ?'
    : 'SELECT 1 FROM emoji_actions WHERE slug = ? AND locale = ? AND user_ip = ? AND action_type = ?';

  // Build params array in the correct order
  const params = userId
    ? [slug, locale, userId, actionType]
    : [slug, locale, userIp, actionType];

  try {
    const result = await env.DB
      .prepare(query)
      .bind(...params)
      .first<{ 1: number }>();

    return !!result;
  } catch (error) {
    console.error('Get user action error:', error);
    return false;
  }
}

// Report operations
export async function createReport(
  env: Env,
  report: Omit<EmojiReport, 'id' | 'created_at'>
): Promise<void> {
  await env.DB
    .prepare(`
      INSERT INTO emoji_reports (
        slug,
        locale,
        user_id,
        reason,
        details,
        status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `)
    .bind(
      report.slug,
      report.locale,
      report.user_id || null,
      report.reason,
      report.details || null
    )
    .run();
}

// Stats update helper
export async function updateStats(env: Env, slug: string, locale: string): Promise<void> {
  const counts = await env.DB
    .prepare(`
      SELECT 
        COUNT(CASE WHEN action_type = 'view' THEN 1 END) as views_count,
        COUNT(CASE WHEN action_type = 'like' THEN 1 END) as likes_count,
        COUNT(CASE WHEN action_type = 'download' THEN 1 END) as downloads_count,
        COUNT(CASE WHEN action_type = 'copy' THEN 1 END) as copies_count,
        COUNT(CASE WHEN action_type = 'report' THEN 1 END) as reports_count,
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
      WHERE slug = ?
    `)
    .bind(slug)
    .first<{
      views_count: number;
      likes_count: number;
      downloads_count: number;
      copies_count: number;
      reports_count: number;
      total_actions_count: number;
      average_rating: number;
      vote_count: number;
    }>();

  if (!counts) return;

  await env.DB
    .prepare(`
      UPDATE emoji_stats SET
        views_count = ?,
        likes_count = ?,
        downloads_count = ?,
        copies_count = ?,
        reports_count = ?,
        average_rating = ?,
        vote_count = ?,
        total_actions_count = ?,
        last_updated_at = ?
      WHERE slug = ?
    `)
    .bind(
      counts.views_count,
      counts.likes_count,
      counts.downloads_count,
      counts.copies_count,
      counts.reports_count,
      counts.average_rating,
      counts.vote_count,
      counts.total_actions_count,
      new Date().toISOString(),
      slug
    )
    .run();
}

export async function addVote(env: Env, slug: string, locale: string, userIp: string, voteType: 'up' | 'down'): Promise<void> {
  // Check if user has already voted
  const existingVote = await env.DB
    .prepare('SELECT vote_type FROM emoji_votes WHERE slug = ? AND user_ip = ? AND locale = ?')
    .bind(slug, userIp, locale)
    .first<{ vote_type: string }>();

  if (existingVote) {
    if (existingVote.vote_type === voteType) {
      return; // Same vote type, do nothing
    }
    // Different vote type, remove old vote and add new one
    await env.DB
      .prepare('UPDATE emojis SET likes_count = CASE WHEN ? = \'up\' THEN likes_count + 1 ELSE likes_count - 1 END, dislikes_count = CASE WHEN ? = \'down\' THEN dislikes_count + 1 ELSE dislikes_count - 1 END WHERE slug = ? AND locale = ?')
      .bind(voteType, voteType, slug, locale)
      .run();

    await env.DB
      .prepare('UPDATE emoji_votes SET vote_type = ? WHERE slug = ? AND user_ip = ? AND locale = ?')
      .bind(voteType, slug, userIp, locale)
      .run();
  } else {
    // New vote
    await env.DB
      .prepare('UPDATE emojis SET likes_count = CASE WHEN ? = \'up\' THEN likes_count + 1 ELSE likes_count END, dislikes_count = CASE WHEN ? = \'down\' THEN dislikes_count + 1 ELSE dislikes_count END WHERE slug = ? AND locale = ?')
      .bind(voteType, voteType, slug, locale)
      .run();

    await env.DB
      .prepare('INSERT INTO emoji_votes (slug, user_ip, vote_type, locale) VALUES (?, ?, ?, ?)')
      .bind(slug, userIp, voteType, locale)
      .run();
  }
}

export async function getVoteStats(env: Env, slug: string, locale: string): Promise<{ likes_count: number; dislikes_count: number }> {
  const result = await env.DB
    .prepare('SELECT likes_count, dislikes_count FROM emojis WHERE slug = ? AND locale = ?')
    .bind(slug, locale)
    .first<{ likes_count: number; dislikes_count: number }>();

  return result || { likes_count: 0, dislikes_count: 0 };
}


// 在 database.ts 中添加
export async function searchEmojisByKeywords(
  env: Env,
  keywords: string[],
  locale: string,
  limit: number = 20,
  offset: number = 0
): Promise<Emoji[]> {
  // 使用 JSON_EACH 和 LIKE 操作符来搜索
  const result = await env.DB
    .prepare(`
      SELECT DISTINCT e.* 
      FROM emojis e
      JOIN emoji_details d ON e.slug = d.slug AND e.locale = d.locale
      WHERE e.locale = ?
      AND e.is_public = 1
      AND (
        SELECT COUNT(*)
        FROM json_each(d.keywords) k
        WHERE k.value IN (${keywords.map(() => '?').join(',')})
      ) > 0
      ORDER BY (
        SELECT COUNT(*)
        FROM json_each(d.keywords) k
        WHERE k.value IN (${keywords.map(() => '?').join(',')})
      ) DESC,
      e.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(
      locale,
      ...keywords,
      ...keywords,
      limit,
      offset
    )
    .all<Emoji>();

  return result.results;
}

// 添加关键词
export async function updateEmojiKeywords(
  env: Env,
  slug: string,
  locale: string,
  keywords: string[]
): Promise<void> {
  await env.DB
    .prepare(`
      INSERT INTO emoji_details (slug, locale, keywords)
      VALUES (?, ?, ?)
      ON CONFLICT(slug, locale) DO UPDATE SET
      keywords = excluded.keywords
    `)
    .bind(
      slug,
      locale,
      JSON.stringify(keywords)
    )
    .run();
}

// 获取热门关键词
export async function getPopularKeywords(
  env: Env,
  locale: string,
  limit: number = 20
): Promise<{ keyword: string; count: number }[]> {
  const result = await env.DB
    .prepare(`
      WITH RECURSIVE
      split_keywords AS (
        SELECT DISTINCT
          value as keyword
        FROM emoji_details d
        CROSS JOIN json_each(d.keywords)
        WHERE d.locale = ?
      ),
      keyword_counts AS (
        SELECT 
          k.keyword,
          COUNT(*) as count
        FROM split_keywords k
        GROUP BY k.keyword
        ORDER BY count DESC
        LIMIT ?
      )
      SELECT * FROM keyword_counts
    `)
    .bind(locale, limit)
    .all<{ keyword: string; count: number }>();

  return result.results;
}

// 添加关键词 优化
export async function searchEmojisByKeywordsOptimized(
  env: Env,
  keywords: string[],
  locale: string,
  limit: number = 20,
  offset: number = 0
): Promise<Emoji[]> {
  // 使用子查询先找到匹配的 emoji_details
  const result = await env.DB
    .prepare(`
      WITH matched_emojis AS (
        SELECT 
          d.slug,
          d.locale,
          COUNT(*) as match_count
        FROM emoji_details d,
          json_each(d.keywords) k
        WHERE d.locale = ?
        AND k.value IN (${keywords.map(() => '?').join(',')})
        GROUP BY d.slug, d.locale
      )
      SELECT e.*
      FROM emojis e
      JOIN matched_emojis m ON e.slug = m.slug AND e.locale = m.locale
      WHERE e.is_public = 1 
      ORDER BY m.match_count DESC, e.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(
      locale,
      ...keywords,
      limit,
      offset
    )
    .all<Emoji>();

  return result.results;
}

// 热门关键词 
export async function getPopularKeywordsOptimized(
  env: Env,
  locale: string,
  limit: number = 20
): Promise<{ keyword: string; count: number }[]> {
  const result = await env.DB
    .prepare(`
      SELECT 
        json_extract(value, '$') as keyword,
        COUNT(*) as count
      FROM emoji_details d,
        json_each(d.keywords)
      WHERE d.locale = ? 
      GROUP BY json_extract(value, '$')
      ORDER BY count DESC
      LIMIT ?
    `)
    .bind(locale, limit)
    .all<{ keyword: string; count: number }>();

  return result.results;
}

// Batch translation operations
export async function getUntranslatedEmojis(
  env: Env,
  targetLocale: string,
  limit: number,
  lastProcessedId?: number
): Promise<Emoji[]> {
  const query = `
    SELECT e.*
    FROM emojis e
    LEFT JOIN emoji_translations et 
      ON e.base_slug = et.base_slug 
      AND et.locale = ? 
    WHERE et.translated_prompt IS NULL
    ${lastProcessedId ? 'AND e.id > ?' : ''}
    ORDER BY e.id
    LIMIT ?
  `;

  const params = lastProcessedId 
    ? [targetLocale, lastProcessedId, limit]
    : [targetLocale, limit];

  const results = await env.DB
    .prepare(query)
    .bind(...params)
    .all<Emoji>();

  return results.results;
}

export async function batchInsertTranslations(
  env: Env,
  translations: Array<{
    slug: string;
    locale: string;
    translated_prompt: string;
  }>
): Promise<void> {
  const stmt = env.DB.prepare(`
    INSERT INTO emoji_translations (base_slug, locale, translated_prompt)
    VALUES (?, ?, ?)
    ON CONFLICT(base_slug, locale) DO UPDATE SET
    translated_prompt = excluded.translated_prompt
  `);

  const batch = translations.map(trans => 
    stmt.bind(trans.slug, trans.locale, trans.translated_prompt)
  );

  await env.DB.batch(batch);
}

export async function getTranslationProgress(
  env: Env,
  locale: string
): Promise<{
  total: number;
  translated: number;
  remaining: number;
  last_processed_id: number | null;
}> {
  const result = await env.DB
    .prepare(`
      WITH stats AS (
        SELECT 
          (SELECT COUNT(*) FROM emojis) as total,
          COUNT(et.translated_prompt) as translated,
          COALESCE(MAX(e.id), 0) as last_processed_id
        FROM emojis e
        LEFT JOIN emoji_translations et 
          ON e.base_slug = et.base_slug 
          AND et.locale = ?
      )
      SELECT 
        total,
        translated,
        (total - translated) as remaining,
        NULLIF(last_processed_id, 0) as last_processed_id
      FROM stats
    `)
    .bind(locale)
    .first<{
      total: number;
      translated: number;
      remaining: number;
      last_processed_id: number | null;
    }>();

  return result || {
    total: 0,
    translated: 0,
    remaining: 0,
    last_processed_id: null
  };
}

// Like operations
export async function toggleEmojiLike(
  env: Env,
  slug: string,
  locale: string,
  userIp: string,
  userId?: string
): Promise<{ liked: boolean }> {
  try {

    try {

      // Check if like record exists
      const existingLike = await env.DB
        .prepare(`
          SELECT id, is_active 
          FROM emoji_likes 
          WHERE slug = ? 
            AND ${userId ? 'user_id' : 'user_ip'} = ?
        `)
        .bind(slug, userId || userIp)
        .first<{ id: number; is_active: boolean }>();

      let newStatus: boolean;
      
      if (existingLike) {
        // Toggle is_active status
        newStatus = !existingLike.is_active;
        await env.DB
          .prepare(`
            UPDATE emoji_likes 
            SET is_active = ?, updated_at = datetime('now')
            WHERE id = ?
          `)
          .bind(newStatus, existingLike.id)
          .run();
      } else {
        // Create new like record
        await env.DB
          .prepare(`
            INSERT INTO emoji_likes (
              slug,
              locale,
              user_id,
              user_ip,
              is_active,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, true, datetime('now'), datetime('now'))
          `)
          .bind(slug, locale, userId || null, userIp)
          .run();
        newStatus = true;
      }

      return { liked: newStatus };
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    throw new Error(`Failed to toggle like: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getEmojiLikeStatus(
  env: Env,
  slug: string,
  userIp: string,
  userId?: string
): Promise<boolean> {
  try {
    const result = await env.DB
      .prepare(`
        SELECT is_active 
        FROM emoji_likes 
        WHERE slug = ? 
          AND ${userId ? 'user_id' : 'user_ip'} = ?
      `)
      .bind(slug, userId || userIp)
      .first<{ is_active: boolean }>();

    return result?.is_active || false;
  } catch (error) {
    console.error('Get like status error:', error);
    return false;
  }
}

export async function translateAndStoreMultiLang(
  env: Env,
  baseSlug: string,
  prompt: string,
  targetLocales: string[]
): Promise<void> {
  try {
    // Get translations for all languages in one call
    const translations = await translateToMultipleLanguages(env, prompt, targetLocales);
    
    // Prepare all insert statements
    const insertPromises = Object.entries(translations).map(([locale, translatedPrompt]) => 
      env.DB.prepare(`
        INSERT INTO emoji_translations (base_slug, locale, translated_prompt)
        VALUES (?, ?, ?)
        ON CONFLICT(base_slug, locale) DO UPDATE SET
        translated_prompt = excluded.translated_prompt
      `).bind(baseSlug, locale, translatedPrompt).run()
    );

    // Execute all inserts in parallel
    await Promise.all(insertPromises);
  } catch (error) {
    console.error(`Batch translation failed for slug ${baseSlug}:`, error);
    throw error;
  }
}

export interface EmojiRecord {
  id: number;
  slug: string;
  image_url: string;
}

export interface AnalysisRecord {
  slug: string;
  locale: string;
  category: string;
  primary_color: string;
  quality_score: number;
  keywords: string[];
}

/**
 * Get unanalyzed emojis from the database
 */
export async function getUnanalyzedEmojis(env: Env, batchSize: number, lastProcessedId = 0): Promise<EmojiRecord[]> {
  const query = `
    SELECT id, slug, image_url 
    FROM emojis 
    WHERE id > $1 
    AND slug NOT IN (
      SELECT slug 
      FROM emoji_details
    )
    ORDER BY id 
    LIMIT $2
  `;
  
  const result = await env.DB.prepare(query)
    .bind(lastProcessedId, batchSize)
    .all();
    
  // Validate and transform the results
  const records = (result?.results || []) as Record<string, unknown>[];
  return records.map(record => ({
    id: Number(record.id),
    slug: String(record.slug),
    image_url: String(record.image_url)
  }));
}

/**
 * Save analysis result to the database
 */
export async function saveAnalysisResult(
  env: Env, 
  slug: string, 
  locale: string, 
  analysis: ImageAnalysisResult
): Promise<void> {
  const query = `
    INSERT INTO emoji_details (
      slug,
      locale,
      category,
      primary_color,
      quality_score,
      subject_count,
      keywords
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT(slug) DO UPDATE SET
      category = excluded.category,
      primary_color = excluded.primary_color,
      quality_score = excluded.quality_score,
      subject_count = excluded.subject_count,
      keywords = excluded.keywords
  `;
  
  await env.DB.prepare(query).bind(
    slug,
    locale,
    analysis.category,
    analysis.primaryColor,
    analysis.qualityScore,
    analysis.subjectCount,
    JSON.stringify(analysis.keywords)
  ).run();
}

/**
 * Get analysis progress statistics
 */
export async function getAnalysisProgress(env: Env): Promise<{
  total: number;
  analyzed: number;
  remaining: number;
}> {
  const totalQuery = `SELECT COUNT(*) as total FROM emojis`;
  const analyzedQuery = `SELECT COUNT(DISTINCT slug) as analyzed FROM emoji_details`;
  
  const [totalResult, analyzedResult] = await Promise.all([
    env.DB.prepare(totalQuery).first(),
    env.DB.prepare(analyzedQuery).first()
  ]);
  
  const total = Number(totalResult?.total || 0);
  const analyzed = Number(analyzedResult?.analyzed || 0);
  
  return {
    total,
    analyzed,
    remaining: total - analyzed
  };
}
