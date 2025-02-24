import { Env } from '../types/env';
import { getLanguageInfo } from '../types/env';

export function isEnglish(text: string): boolean {
  const englishRegex = /[A-Za-z0-9\s]/g;
  const englishChars = (text.match(englishRegex) || []).length;
  return englishChars / text.length >= 0.7;
}

// export async function translatePrompt(env: Env, prompt: string): Promise<string> {
//   try {
//     const messages = [
//       { role: "system", content: "You are a professional translator. Strictly translate the text to English. Return ONLY the translated text without any additional text." },
//       { role: "user", content: prompt }
//     ];

//     const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", { messages });
//     if (!response || !response.response) {
//       throw new Error('Invalid translation response');
//     }

//     return response.response;
//   } catch (error) {
//     console.error('Translation error:', error);
//     throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//   }
// } 

// export async function translateText(env: Env, text: string, targetLang: string): Promise<string> {
//   try {
//     const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
//       text,
//       source_lang: 'en',
//       target_lang: targetLang
//     });

//     return response.translated_text;
//   } catch (error) {
//     console.error(`Translation failed for "${text}" to ${targetLang}:`, error);
//     throw error;
//   }
// }


  
// Test translation with Llama model
export async function translateText(env: Env, text: string, targetLocale: string): Promise<string> {
  const targetLang = getLanguageInfo(targetLocale).name;
  try {
    const response = await fetch(`https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/genmoji/grok/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.XAI_API_KEY}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLang}. Keep it concise and suitable for a sticker description. Only return the translated text without any explanations or additional content.` 
          },
          {
            role: "user",
            content: text
          }
        ],
        model: "grok-2-latest",
        stream: false,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    if (!result.choices?.[0]?.message?.content) {
      throw new Error('Invalid translation response format');
    }

    return result.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Translation failed for "${text}" to ${targetLang}:`, error);
    return text;
  }
}

// Add new function for multi-language translation
export async function translateToMultipleLanguages(env: Env, text: string, targetLocales: string[]): Promise<Record<string, string>> {
  try {
    // Create translation promises for all languages
    const translationPromises = targetLocales.map(async (locale) => {
      try {
        const translation = await translateText(env, text, locale);
        return [locale, translation] as const;
      } catch (error) {
        console.error(`Translation failed for language ${locale}:`, error);
        return [locale, text] as const;
      }
    });

    // Execute all translations in parallel
    const results = await Promise.all(translationPromises);
    
    // Convert results to object
    return Object.fromEntries(results);
  } catch (error) {
    console.error(`Translation failed for "${text}":`, error);
    // Return original text for all languages as fallback
    return Object.fromEntries(targetLocales.map(locale => [locale, text]));
  }
}
