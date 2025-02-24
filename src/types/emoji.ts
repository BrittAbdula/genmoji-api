export interface Emoji {
  id?: number;
  prompt: string;
  slug: string;
  base_slug: string;
  image_url: string;
  created_at: string;
  original_prompt?: string | null;
  is_public: boolean;
  ip?: string;
  locale: string;
  has_reference_image: boolean;
  model: string;
}

export interface EmojiDetails {
  id?: number;
  slug: string;
  locale: string;
  category?: EmojiCategory;
  primary_color?: string;
  keywords?: string;
  quality_score?: number;
}

export type EmojiCategory = 
  | 'smileys_emotion'
  | 'people_body'
  | 'animals_nature'
  | 'food_drink'
  | 'travel_places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

export interface EmojiStats {
  id?: number;
  slug: string;
  locale: string;
  views_count: number;
  likes_count: number;
  downloads_count: number;
  copies_count: number;
  reports_count: number;
  average_rating: number;
  vote_count: number;
  source?: string;
  total_actions_count: number;
  last_updated_at: string;
}

export type ActionType = 'view' | 'like' | 'download' | 'copy' | 'report' | 'rate' | 'share' | 'upvote' | 'downvote';

export interface EmojiAction {
  id?: number;
  slug: string;
  locale: string;
  user_id?: string;
  user_ip: string;
  action_type: ActionType;
  action_details?: string;
  created_at?: string;
}

export interface User {
  id: number;
  auth_id: string;
  created_at: string;
}

export type ReportReason = 'inappropriate' | 'deceptive' | 'offensive';

export interface EmojiReport {
  id?: number;
  slug: string;
  locale: string;
  user_id?: string;
  reason: ReportReason;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface EmojiResponse {
  emoji: Emoji;
  details?: EmojiDetails;
  stats?: EmojiStats;
}

export interface VectorMetadata {
  prompt: string;
  translated_prompt: string;
  image_url: string;
  created_at: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  values: number[];
  metadata: VectorMetadata;
}

export interface ReplicateResponse {
  id: string;
  status: string;
  output: string[] | null;
  urls: {
    get: string;
  };
}

export interface RemoveBgResponse {
  id: string;
  status: string;
  output: string;
  urls: {
    get: string;
  };
}

export interface CloudflareImagesUploadResult {
  success: boolean;
  errors: Array<{ message: string }>;
  result: {
    id: string;
  };
}

export interface Report {
  id?: number;
  slug: string;
  reason: ReportReason;
  details?: string;
  user_ip: string;
  created_at: string;
  locale: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

export interface RatingDetails {
  score: number; // 1-5
  comment?: string;
} 