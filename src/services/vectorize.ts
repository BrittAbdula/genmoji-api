import { Env } from '../types/env';
import { Emoji } from '../types/emoji';

export async function generateEmbedding(env: Env, texts: string[]): Promise<number[][]> {
  try {
    const response = await env.AI.run("@cf/baai/bge-small-en-v1.5", { 
      text: texts
    });

    if (!response?.data) {
      throw new Error('Invalid embedding response');
    }

    return response.data;
  } catch (error) {
    // console.log('embedding tests: ', texts)
    console.error('Embedding generation error:', error );
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function storeEmojiVector(env: Env, emoji: Emoji): Promise<void> {
  try {
    const vector = await generateEmbedding(env, [emoji.prompt]);
    
    await env.VECTORIZE.insert([{
      id: emoji.id?.toString() || '',
      values: vector[0],
      metadata: {
        prompt: emoji.prompt,
        slug: emoji.slug,
        image_url: emoji.image_url,
        created_at: emoji.created_at
      }
    }]);
  } catch (error) {
    console.error('Vector storage error:', error);
    throw error;
  }
}

export async function searchEmojisByVector(
  env: Env,
  prompt: string,
  limit: number,
  offset: number = 0,
  excludeId?: string,
  locale?: string
): Promise<Emoji[]> {
  try {
    const queryVector = await generateEmbedding(env, [prompt]);

    // Limit topK to maximum of 20
    const maxTopK = 20;
    const effectiveLimit = Math.min(limit + offset + (excludeId ? 1 : 0), maxTopK);
    
    const results = await env.VECTORIZE.query(queryVector[0], {
      topK: effectiveLimit
    });
    
    if (results.matches.length === 0) {
      return [];
    }

    // Filter and get IDs for database query
    const matchedIds = results.matches
      .filter(match => !excludeId || match.id !== excludeId)
      .slice(offset, offset + limit)
      .map(match => match.id);

    if (matchedIds.length === 0) {
      return [];
    }

    // Get full emoji objects from database
    const placeholders = matchedIds.map(() => '?').join(',');
    const emojis = await env.DB
      .prepare(`SELECT 
          e.id, 
          e.slug, 
          e.image_url, 
          e.created_at, 
          e.is_public, 
          e.ip, 
          e.has_reference_image,
          COALESCE(et.translated_prompt, e.prompt) as prompt,
          e.model
        FROM emojis e
        LEFT JOIN emoji_translations et ON e.base_slug = et.base_slug AND et.locale = ? 
        WHERE e.id IN (${placeholders}) AND e.is_public = 1`)
      .bind(locale, ...matchedIds)
      .all<Emoji>();

    if (!emojis?.results) {
      return [];
    }

    // Sort by vector search score
    const scoreMap = new Map(results.matches.map(m => [m.id, m.score]));
    return emojis.results.sort((a, b) => {
      const scoreA = scoreMap.get(a.id?.toString() || '') || 0;
      const scoreB = scoreMap.get(b.id?.toString() || '') || 0;
      return scoreB - scoreA;
    });
  } catch (error) {
    console.error('Vector search error:', error instanceof Error ? error.message : error);
    return [];
  }
} 