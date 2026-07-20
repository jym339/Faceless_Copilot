export interface Channel {
  id: string;
  title: string;
  handle: string;
  avatar_url: string;
  subscriber_count: number;
  created_at: string;
  avg_views_longform: number;
  avg_views_shorts: number;
  is_on_watchlist: boolean;
  niche_id?: string;
  first_video_published_at?: string;
  last_checked_at?: string;
}

export interface Video {
  id: string;
  channel_id: string;
  channel_name: string;
  avatar_url: string;
  subscriber_count: number;
  title: string;
  thumbnail_url: string;
  published_at: string;
  duration_seconds: number;
  format: 'long' | 'short';
  view_count: number;
  outlier_multiplier: number;
  discovered_at: string;
  is_ignored: boolean;
}
