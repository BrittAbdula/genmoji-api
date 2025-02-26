import { Env } from '../types/env';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// Define enums and schemas
const EmojiCategoryEnum = z.enum([
  'smileys_emotion',
  'people_body',
  'animals_nature',
  'food_drink',
  'travel_places',
  'activities',
  'objects',
  'symbols',
  'flags'
]).describe('Category of the emoji');

// Schema for image analysis result
const ImageAnalysisSchema = z.object({
  category: EmojiCategoryEnum.describe('Category of the emoji'),
  primaryColor: z.string()
    .min(3)
    .max(30)
    .describe('Basic color term (e.g., sky blue, grass green)'),
  qualityScore: z.number()
    .int()
    .min(0)
    .max(5)
    .describe('Quality score from 0 to 5'),
  subjectCount: z.number()
    .int()
    .min(1)
    .max(3)
    .describe('Number of distinct subjects (1-3)'),
  keywords: z.array(z.string())
    .min(3)
    .max(5)
    .describe('Array of 3-5 descriptive keywords')
});

// Export types based on the schema
export type EmojiCategory = z.infer<typeof EmojiCategoryEnum>;
export type ImageAnalysisResult = z.infer<typeof ImageAnalysisSchema>;

/**
 * Example response:
 * {
 *   "category": "animals_nature",
 *   "primaryColor": "grass green",
 *   "qualityScore": 4,
 *   "subjectCount": 2,
 *   "keywords": ["cute", "panda", "bamboo", "eating"]
 * }
 */
export async function analyzeImage(env: Env, imageUrl: string): Promise<ImageAnalysisResult> {
  try {
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/genmoji/grok/v1`
    });

    const completion = await client.chat.completions.create({
      model: "grok-2-vision-latest",
      messages: [
        {
          role: "system",
          content: `You are an expert emoji image analyzer. Your task is to analyze emoji-style images and provide structured analysis results.

<rules>
1. category:
   - Choose based on primary theme and purpose
   - Use people_body or smileys_emotion for character emojis
   - Use appropriate category for objects and symbols

2. primaryColor:
   - Use widely understood color terms (e.g., sky blue, grass green)
   - Focus on the most eye-catching or emotionally significant color
   - Keep descriptions simple and clear

3. qualityScore:
   - 5: Perfect (clear, expressive, well-designed)
   - 4: Very good (minor imperfections)
   - 3: Good (noticeable but acceptable issues)
   - 2: Fair (significant issues)
   - 1: Poor (major design problems)
   - 0: Unusable

4. subjectCount:
   - Count distinct visual elements
   - Maximum value is 3
   - Count faces as one subject
   - Count major components in composite emojis

5. keywords:
   - Include emotional expressions (happy, sad, excited)
   - Include main subjects (cat, heart, star)
   - Include actions (running, eating, sleeping)
   - Include distinctive features (sparkly, cute, funny)
   - Keep words simple and emoji-relevant
</rules>`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this emoji image:"
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      response_format: zodResponseFormat(ImageAnalysisSchema, "emoji analysis"),
      temperature: 0.1
    }) as unknown as { choices: [{ message: { content: string } }] };

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Invalid image analysis response format');
    }

    return JSON.parse(content) as ImageAnalysisResult;

  } catch (error) {
    console.error(`Image analysis failed for "${imageUrl}":`, error);
    throw error;
  }
} 