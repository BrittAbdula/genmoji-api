import { Env } from '../types/env';
import { ReplicateResponse, RemoveBgResponse, Emoji } from '../types/emoji';
import { ImageAnalysisResult } from '../utils/imageAnalysis';
import { analyzeImage } from '../utils/imageAnalysis';
import { saveAnalysisResult } from './database';

export async function generateEmoji(env: Env, prompt: string, image?: string, model?: string): Promise<string> {
  let predictionBody: any;
  if (model === 'sticker') {
    predictionBody = {
      version: "4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a",
      input: {
        prompt: prompt,
        num_outputs: 1,
        width: 1024,
        height: 1024,
        refine: "no_refiner",
        scheduler: "K_EULER",
        negative_prompt: "bubbles",
        num_inference_steps: 20,
        output_quality: 100,
        upscale: true,
        upscale_steps: 10,
        seed: Math.floor(Math.random() * 1000000),
      }
    };

    if (image) {
      predictionBody = {
        version: "764d4827ea159608a07cdde8ddf1c6000019627515eb02b6b449695fd547e5ef",
        input: {
          prompt: prompt,
          steps: 20,
          width: 1024,
          height: 1024,
          upscale: false,
          upscale_steps: 10,
          negative_prompt: "",
          prompt_strength: 4.5,
          ip_adapter_noise: 0.5,
          ip_adapter_weight: 0.2,
          instant_id_strength: 0.8,
          image: image
        }
      };
    }
  }else if (model === 'mascot'){
    predictionBody = {
      version: "4acb778eb059772225ec213948f0660867b2e03f277448f18cf1800b96a65a1a",
      input: {
        prompt: `In the style of TOK, ${prompt}`,
        num_outputs: 1,
        width: 1024,
        height: 1024,
        lora_scale: 0.6,
        guidance_scale: 7.5,
        high_noise_frac: 0.8,
        prompt_strength: 0.8,
        negative_prompt: "bubbles",
        num_inference_steps: 40,
        seed: Math.floor(Math.random() * 1000000),
      }
    };
  }
  else{
  const enhancedPrompt = `A TOK emoji of a ${prompt}`;
  predictionBody = {
    version: "dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e",
    input: {
      prompt: enhancedPrompt,
      num_outputs: 1,
      width: 768,
      height: 768,
      negative_prompt: "racist, xenophobic, antisemitic, islamophobic, bigoted",
      num_inference_steps: 30,
        seed: Math.floor(Math.random() * 1000000),
      }
    };

    if (image) {
      predictionBody.input.image = image;
    }
  }

  const prediction = await fetch(
    `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/genmoji/replicate/predictions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(predictionBody),
    }
  );

  if (!prediction.ok) {
    throw new Error(`Gateway error: ${await prediction.text()}`);
  }

  const predictionData = await prediction.json() as ReplicateResponse;
  return predictionData.urls.get;
}

export async function removeBackground(env: Env, imageUrl: string): Promise<string> {
  const removeBgPrediction = await fetch(
    `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/genmoji/replicate/predictions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
        input: {
          image: imageUrl
        }
      }),
    }
  );

  if (!removeBgPrediction.ok) {
    throw new Error('Failed to start background removal');
  }

  const removeBgData = await removeBgPrediction.json() as RemoveBgResponse;
  return removeBgData.urls.get;
}

export async function pollPrediction(url: string, env: Env, maxAttempts: number = 30, initialDelay: number = 6000, model: string = 'emoji'): Promise<string> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.REPLICATE_API_TOKEN}`,
      },
    });
    
    const result = await response.json() as ReplicateResponse | RemoveBgResponse;
    
    if (result.status === 'succeeded' && result.output) {
      // if (model === 'sticker') {
      //   console.log('sticker--->', result.output);
      //   return Array.isArray(result.output) ? result.output[-1] : result.output;
      // }
      return Array.isArray(result.output) ? result.output[0] : result.output;
    }

    if (result.status === 'failed') {
      throw new Error('Prediction failed');
    }

    await new Promise(resolve => setTimeout(resolve, attempts === 0 ? initialDelay : 1000));
    attempts++;
  }

  throw new Error('Timeout waiting for prediction');
} 

export async function analyzeEmoji(env: Env, emoji: Emoji): Promise<ImageAnalysisResult> {
  const analysis = await analyzeImage(env, emoji.image_url);
  await saveAnalysisResult(env, emoji.slug, 'en', analysis);
  return analysis;
}