import { Env } from '../types/env';
import { CloudflareImagesUploadResult } from '../types/emoji';

export async function uploadToCloudflareImages(env: Env, imageUrl: string): Promise<string> {
  const formData = new FormData();
  formData.append('url', imageUrl);

  const uploadResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image to Cloudflare Images');
  }

  const uploadResult = await uploadResponse.json() as CloudflareImagesUploadResult;
  if (!uploadResult.success) {
    throw new Error('Failed to upload image: ' + uploadResult.errors[0]?.message);
  }

  return `${env.CLOUDFLARE_IMAGES_DELIVERY_URL}/${uploadResult.result.id}/public`;
} 