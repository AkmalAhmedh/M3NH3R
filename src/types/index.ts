export interface Profile {
  id: string;
  couple_id: string | null;
  pending_partner_id: string | null;
  email: string;
  username: string;
  avatar_url: string | null;
  mood: string | null;
  mood_emoji: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: string;
  name: string | null;
  anniversary_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  issuer_id: string;
  is_used: boolean;
  created_at: string;
}

export interface BreakupRequest {
  id: string;
  couple_id: string;
  initiator_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  couple_id: string;
  title: string;
  content: string | null;
  category: 'Movie' | 'Game' | 'Food' | 'Travel' | 'Call' | 'Date' | 'Gift' | 'Personal';
  date: string;
  created_by: string;
  created_at: string;
  assets?: MemoryAsset[];
}

export interface MemoryAsset {
  id: string;
  memory_id: string;
  file_path: string;
  file_type: 'image' | 'video' | 'audio';
  created_at: string;
}

export interface SandboxCard {
  id: string;
  couple_id: string;
  title: string;
  status: 'wishlist' | 'right_now' | 'core_memories';
  category: string;
  metadata: {
    photoUrl?: string;
    notes?: string;
    reactions?: string[];
    date?: string;
    voiceUrl?: string;
    rating?: number;
    subCategory?: string;
  };
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Drawing {
  id: string;
  couple_id: string;
  name: string;
  thumbnail_url: string | null;
  canvas_data: unknown; // SVG/Canvas paths representation
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DrawingAsset {
  id: string;
  drawing_id: string;
  asset_path: string;
  created_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  mood: string;
  mood_emoji: string;
  notes: string | null;
  created_at: string;
}

export interface Want {
  id: string;
  couple_id: string;
  user_id: string;
  content: string;
  is_sensitive: boolean;
  category: 'cravings' | 'future plans' | 'activities' | 'emotional needs' | 'wishlist';
  created_at: string;
}

export interface Wishlist {
  id: string;
  couple_id: string;
  title: string;
  category: string;
  order_index: number;
  created_at: string;
}

export interface Movie {
  id: string;
  couple_id: string;
  title: string;
  type: string; // movie, series
  rating: number;
  review: string | null;
  poster_url: string | null;
  watched_at: string;
  created_at: string;
}

export interface Game {
  id: string;
  couple_id: string;
  title: string;
  hours_played: number;
  screenshot_url: string | null;
  notes: string | null;
  played_at: string;
  created_at: string;
}

export interface LocationLog {
  id: string;
  couple_id: string;
  name: string;
  type: 'meetup' | 'restaurant' | 'cafe' | 'trip';
  lat: number;
  lng: number;
  note: string | null;
  visited_at: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  couple_id: string;
  title: string;
  content: string | null;
  audio_url: string | null;
  emoji: string | null;
  date: string;
  created_by: string;
  created_at: string;
}

export interface VoiceCapsule {
  id: string;
  couple_id: string;
  title: string;
  file_path: string;
  category: 'good_morning' | 'good_night' | 'anniversary' | 'custom';
  created_by: string;
  created_at: string;
}

export interface LoveLetter {
  id: string;
  couple_id: string;
  recipient_id: string;
  content: string;
  unlock_date: string;
  created_by: string;
  created_at: string;
}

export interface TimeCapsule {
  id: string;
  couple_id: string;
  title: string;
  content: string | null;
  assets_paths: string[];
  unlock_date: string;
  created_by: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  couple_id: string;
  recipient_id: string;
  sender_id: string;
  type: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Achievement {
  id: string;
  couple_id: string;
  name: string;
  description: string;
  unlocked_at: string;
  criteria_type: string;
  created_at: string;
}

export interface SafeSpace {
  id: string;
  couple_id: string;
  pin_hash: string;
  created_at: string;
  updated_at: string;
}
