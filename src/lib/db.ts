import { supabase } from './supabaseClient';
import { 
  Profile, Couple, BreakupRequest, Memory, SandboxCard, Drawing, MoodLog, Want, Movie, Game, LocationLog, 
  JournalEntry, VoiceCapsule, LoveLetter, TimeCapsule, AppNotification, 
  Achievement, GameScore
} from '../types';

export const db = {
  isSupabase: () => true,

  // --- Profile / Auth Helpers ---
  createProfile: async (userId: string, email: string, username?: string): Promise<Profile> => {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        username: username || email.split('@')[0],
        mood: null,
        mood_emoji: null,
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getCurrentProfile: async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  updateProfileName: async (userId: string, newName: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ username: newName, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      console.error('Error updating name:', error);
      return null;
    }
    return data;
  },

  getPartnerProfile: async (coupleId: string, myId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('couple_id', coupleId)
      .neq('id', myId)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  updateProfileMood: async (userId: string, mood: string, emoji: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ mood, mood_emoji: emoji, last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    
    // Also log mood history (non-blocking)
    supabase.from('mood_logs').insert({ user_id: userId, mood, mood_emoji: emoji }).then(() => null);
    return data;
  },

  getMoodHistory: async (coupleId: string): Promise<MoodLog[]> => {
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('couple_id', coupleId);
    
    if (!partnerProfile || partnerProfile.length === 0) return [];
    const ids = partnerProfile.map(p => p.id);

    const { data, error } = await supabase
      .from('mood_logs')
      .select('*')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return [];
    return data;
  },

  // --- Partner Linking System ---
  generateInviteCode: async (userId: string): Promise<string> => {
    const code = `STAR-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const { error } = await supabase
      .from('partner_invites')
      .insert({ 
        code, 
        owner_id: userId,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      });
    if (error) throw error;
    return code;
  },

  getInviteCode: async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('partner_invites')
      .select('code')
      .eq('owner_id', userId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return data.code;
  },

  requestPartnerConnection: async (inviteCode: string): Promise<{ success: boolean; invite_id?: string }> => {
    const { data, error } = await supabase
      .rpc('request_partner_connection', { invite_code_input: inviteCode });
    if (error) throw error;
    return data as { success: boolean; invite_id: string };
  },

  acceptPartnerConnection: async (inviteId: string): Promise<{ success: boolean; couple_id?: string }> => {
    const { data, error } = await supabase
      .rpc('accept_partner_connection', { invite_id_input: inviteId });
    if (error) throw error;
    return data as { success: boolean; couple_id: string };
  },

  declinePartnerConnection: async (inviteId: string): Promise<{ success: boolean }> => {
    const { data, error } = await supabase
      .rpc('decline_partner_connection', { invite_id_input: inviteId });
    if (error) throw error;
    return data as { success: boolean };
  },

  cancelPendingLink: async (myId: string): Promise<void> => {
    const { error } = await supabase
      .from('partner_invites')
      .update({ target_user_id: null })
      .eq('target_user_id', myId)
      .eq('status', 'pending');
    if (error) throw error;
  },

  getCouple: async (coupleId: string): Promise<Couple | null> => {
    const { data, error } = await supabase
      .from('couples')
      .select('*')
      .eq('id', coupleId)
      .single();
    if (error) return null;
    return data as Couple;
  },

  updateAnniversary: async (coupleId: string, date: string): Promise<Couple | null> => {
    const { data, error } = await supabase
      .from('couples')
      .update({ anniversary_date: date, updated_at: new Date().toISOString() })
      .eq('id', coupleId)
      .select()
      .single();
    if (error) throw error;
    return data as Couple;
  },

  // --- Breakup Consent System ---
  // FIXED: These RPCs are called server-side via Supabase RPC, which uses the
  // auth context automatically. Params are passed correctly.
  initiateBreakup: async (coupleId: string, myId: string): Promise<void> => {
    // The RPC uses auth.uid() internally, so we just call it
    const { error } = await supabase.rpc('initiate_breakup', { couple_id_input: coupleId, initiator_id_input: myId });
    if (error) throw error;
  },

  respondToBreakup: async (requestId: string, accept: boolean, coupleId: string): Promise<void> => {
    const { error } = await supabase.rpc('respond_to_breakup', { accept_input: accept, couple_id_input: coupleId });
    if (error) throw error;
  },

  // --- Memories & Star System ---
  getMemories: async (coupleId: string): Promise<Memory[]> => {
    const { data, error } = await supabase
      .from('memories')
      .select('*, memory_assets(*)')
      .eq('couple_id', coupleId)
      .order('date', { ascending: false });
    if (error) return [];
    return data || [];
  },

  addMemory: async (
    coupleId: string, 
    userId: string, 
    title: string, 
    content: string, 
    category: Memory['category'], 
    date: string, 
    filePaths?: { path: string, type: 'image' | 'video' | 'audio' }[]
  ): Promise<Memory> => {
    const { data: memory, error } = await supabase
      .from('memories')
      .insert({ couple_id: coupleId, title, content, category, date, created_by: userId })
      .select()
      .single();
    
    if (error || !memory) throw error || new Error('Failed to create memory star.');

    if (filePaths && filePaths.length > 0) {
      const assetRows = filePaths.map(f => ({
        memory_id: memory.id,
        file_path: f.path,
        file_type: f.type
      }));
      await supabase.from('memory_assets').insert(assetRows);
    }

    // Add achievement checks (non-blocking)
    db.checkAndUnlockAchievements(coupleId).catch(console.error);

    return memory;
  },

  // --- Sandbox & Wishlist ---
  getSandboxCards: async (coupleId: string): Promise<SandboxCard[]> => {
    const { data, error } = await supabase
      .from('sandbox_cards')
      .select('*')
      .eq('couple_id', coupleId)
      .order('order_index', { ascending: true });
    if (error) return [];
    return data || [];
  },

  createSandboxCard: async (coupleId: string, title: string, status: SandboxCard['status'], category: string, metadata: SandboxCard['metadata']): Promise<SandboxCard> => {
    const { data, error } = await supabase
      .from('sandbox_cards')
      .insert({ couple_id: coupleId, title, status, category, metadata })
      .select()
      .single();
    if (error || !data) throw error || new Error('Failed to create sandbox card.');
    return data;
  },

  updateSandboxCardStatus: async (cardId: string, status: SandboxCard['status'], metadataUpdates?: Partial<SandboxCard['metadata']>): Promise<SandboxCard> => {
    const updates: { status: SandboxCard['status']; metadata?: SandboxCard['metadata'] } = { status };
    if (metadataUpdates) {
      updates.metadata = metadataUpdates as SandboxCard['metadata'];
    }
    const { data, error } = await supabase
      .from('sandbox_cards')
      .update(updates)
      .eq('id', cardId)
      .select()
      .single();
    if (error || !data) throw error || new Error('Failed to update sandbox card.');

    // If moved to core memory, create a memory star automatically (non-blocking)
    if (status === 'core_memories') {
      const paths = data.metadata.photoUrl ? [{ path: data.metadata.photoUrl, type: 'image' as const }] : [];
      db.addMemory(
        data.couple_id, 
        'system', 
        data.title, 
        data.metadata.notes || 'Moved from Wishlist into Core Memories!', 
        (data.category as Memory['category']) || 'Personal', 
        data.metadata.date || new Date().toISOString().split('T')[0],
        paths
      ).catch(console.error);
    }

    return data;
  },

  deleteSandboxCard: async (cardId: string): Promise<void> => {
    await supabase.from('sandbox_cards').delete().eq('id', cardId);
  },

  // --- Wants (His / Her Preferences) ---
  getWants: async (coupleId: string): Promise<Want[]> => {
    const { data, error } = await supabase
      .from('wants')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  addWant: async (coupleId: string, userId: string, content: string, category: Want['category'], isSensitive: boolean): Promise<Want> => {
    const { data, error } = await supabase
      .from('wants')
      .insert({ couple_id: coupleId, user_id: userId, content, category, is_sensitive: isSensitive })
      .select()
      .single();
    if (error || !data) throw error;
    return data;
  },

  deleteWant: async (wantId: string): Promise<void> => {
    await supabase.from('wants').delete().eq('id', wantId);
  },

  // --- Collaborative Drawing Canvas ---
  getDrawings: async (coupleId: string): Promise<Drawing[]> => {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .eq('couple_id', coupleId)
      .order('updated_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  saveDrawing: async (coupleId: string, userId: string, name: string, canvasData: unknown, thumbnailUrl?: string, isPinned = false): Promise<Drawing> => {
    // First, un-pin any existing pinned drawing for this couple
    if (isPinned) {
      await supabase
        .from('drawings')
        .update({ is_pinned: false })
        .eq('couple_id', coupleId)
        .eq('is_pinned', true);
    }
    const { data, error } = await supabase
      .from('drawings')
      .insert({ couple_id: coupleId, name, canvas_data: canvasData, thumbnail_url: thumbnailUrl, is_pinned: isPinned, created_by: userId })
      .select()
      .single();
    if (error || !data) throw error;
    return data;
  },

  pinDrawing: async (drawingId: string, pin: boolean): Promise<Drawing | null> => {
    const { data, error } = await supabase
      .from('drawings')
      .update({ is_pinned: pin })
      .eq('id', drawingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Trackers: Popcorn, Games, Locations ---
  getMovies: async (coupleId: string): Promise<Movie[]> => {
    const { data } = await supabase.from('movies').select('*').eq('couple_id', coupleId).order('watched_at', { ascending: false });
    return data || [];
  },

  addMovie: async (coupleId: string, title: string, type: string, rating: number, review: string, posterUrl: string, watchedAt: string): Promise<Movie> => {
    const { data, error } = await supabase
      .from('movies')
      .insert({ couple_id: coupleId, title, type, rating, review, poster_url: posterUrl, watched_at: watchedAt })
      .select()
      .single();
    if (error) throw error;
    db.checkAndUnlockAchievements(coupleId).catch(console.error);
    return data;
  },

  getGames: async (coupleId: string): Promise<Game[]> => {
    const { data } = await supabase.from('games').select('*').eq('couple_id', coupleId).order('played_at', { ascending: false });
    return data || [];
  },

  addGame: async (coupleId: string, title: string, hoursPlayed: number, screenshotUrl: string, notes: string, playedAt: string): Promise<Game> => {
    const { data, error } = await supabase
      .from('games')
      .insert({ couple_id: coupleId, title, hours_played: hoursPlayed, screenshot_url: screenshotUrl, notes, played_at: playedAt })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getLocations: async (coupleId: string): Promise<LocationLog[]> => {
    const { data } = await supabase.from('locations').select('*').eq('couple_id', coupleId).order('visited_at', { ascending: false });
    return data || [];
  },

  addLocation: async (coupleId: string, name: string, type: LocationLog['type'], lat: number, lng: number, note: string, visitedAt: string): Promise<LocationLog> => {
    const { data, error } = await supabase
      .from('locations')
      .insert({ couple_id: coupleId, name, type, lat, lng, note, visited_at: visitedAt })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Safe Space Vault (Pin Protection) ---
  checkSafeSpacePin: async (coupleId: string, pin: string): Promise<boolean> => {
    const hash = await hashPin(pin);
    const { data, error } = await supabase
      .from('safe_space')
      .select('pin_hash')
      .eq('couple_id', coupleId)
      .maybeSingle();
    if (error || !data) return false;
    return data.pin_hash === hash;
  },

  hasSafeSpacePin: async (coupleId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('safe_space')
      .select('id')
      .eq('couple_id', coupleId)
      .maybeSingle();
    return !!data;
  },

  setSafeSpacePin: async (coupleId: string, pin: string): Promise<void> => {
    const hash = await hashPin(pin);
    const { error } = await supabase
      .from('safe_space')
      .insert({ couple_id: coupleId, pin_hash: hash });
    if (error) throw error;
  },

  // --- Shared Journal ---
  getJournals: async (coupleId: string): Promise<JournalEntry[]> => {
    const { data } = await supabase
      .from('journals')
      .select('*')
      .eq('couple_id', coupleId)
      .order('date', { ascending: false });
    return data || [];
  },

  addJournal: async (coupleId: string, userId: string, title: string, content: string, emoji: string, date: string, audioUrl?: string): Promise<JournalEntry> => {
    const { data, error } = await supabase
      .from('journals')
      .insert({ couple_id: coupleId, created_by: userId, title, content, emoji, date, audio_url: audioUrl })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Voice Capsules ---
  getVoiceCapsules: async (coupleId: string): Promise<VoiceCapsule[]> => {
    const { data } = await supabase
      .from('voice_capsules')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  addVoiceCapsule: async (coupleId: string, userId: string, title: string, filePath: string, category: VoiceCapsule['category']): Promise<VoiceCapsule> => {
    const { data, error } = await supabase
      .from('voice_capsules')
      .insert({ couple_id: coupleId, created_by: userId, title, file_path: filePath, category })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Love Letters (Unlock Date) ---
  getLoveLetters: async (coupleId: string, userId: string): Promise<LoveLetter[]> => {
    const { data, error } = await supabase
      .from('love_letters')
      .select('*')
      .eq('couple_id', coupleId);
    if (error) return [];
    
    // Filter out locked letters that are not created by me
    const today = new Date().toISOString().split('T')[0];
    return (data || []).filter(l => l.created_by === userId || l.unlock_date <= today);
  },

  addLoveLetter: async (coupleId: string, userId: string, recipientId: string, content: string, unlockDate: string): Promise<LoveLetter> => {
    const { data, error } = await supabase
      .from('love_letters')
      .insert({ couple_id: coupleId, created_by: userId, recipient_id: recipientId, content, unlock_date: unlockDate })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Time Capsules (Countdown Lock) ---
  getTimeCapsules: async (coupleId: string, userId: string): Promise<TimeCapsule[]> => {
    const { data, error } = await supabase
      .from('time_capsules')
      .select('*')
      .eq('couple_id', coupleId);
    if (error) return [];

    const today = new Date().toISOString().split('T')[0];
    return (data || []).filter(tc => tc.created_by === userId || tc.unlock_date <= today);
  },

  addTimeCapsule: async (coupleId: string, userId: string, title: string, content: string, assetsPaths: string[], unlockDate: string): Promise<TimeCapsule> => {
    const { data, error } = await supabase
      .from('time_capsules')
      .insert({ couple_id: coupleId, created_by: userId, title, content, assets_paths: assetsPaths, unlock_date: unlockDate })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- Notifications ---
  getNotifications: async (coupleId: string, userId: string): Promise<AppNotification[]> => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('couple_id', coupleId)
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  },

  markNotificationsRead: async (coupleId: string, userId: string): Promise<void> => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('couple_id', coupleId)
      .eq('recipient_id', userId);
  },

  // --- Achievements Checker ---
  getAchievements: async (coupleId: string): Promise<Achievement[]> => {
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .eq('couple_id', coupleId)
      .order('unlocked_at', { ascending: false });
    return data || [];
  },

  checkAndUnlockAchievements: async (coupleId: string): Promise<Achievement[]> => {
    const unlocked: Achievement[] = [];
    
    // Fetch stats
    const memories = await db.getMemories(coupleId);
    const movies = await db.getMovies(coupleId);

    const checkAndInsert = async (name: string, desc: string, criteria: string) => {
      const { data } = await supabase
        .from('achievements')
        .select('id')
        .eq('couple_id', coupleId)
        .eq('name', name)
        .maybeSingle();
      const alreadyUnlocked = !!data;

      if (!alreadyUnlocked) {
        const achRow = {
          couple_id: coupleId,
          name,
          description: desc,
          criteria_type: criteria,
          unlocked_at: new Date().toISOString()
        };
        const { data: inserted } = await supabase.from('achievements').insert(achRow).select().single();
        if (inserted) unlocked.push(inserted);
      }
    };

    if (memories.length > 0) await checkAndInsert('First Memory', 'Recorded your very first memory star together.', 'memory');
    if (memories.length >= 5) await checkAndInsert('Nebula Builders', 'Created 5 memory stars together.', 'memory');
    if (movies.length >= 1) await checkAndInsert('Movie Night', 'Logged your first popcorn movie rating.', 'movie');
    if (movies.length >= 5) await checkAndInsert('Cinephiles', 'Watched and rated 5 movies or series together.', 'movie');

    // Game achievements
    const gameScores = await db.getGameScores(coupleId);
    if (gameScores.length >= 1) await checkAndInsert('Player One', 'Played your very first mini-game together!', 'game');
    if (gameScores.length >= 10) await checkAndInsert('Game Masters', 'Played 10 mini-games together. Unstoppable duo!', 'game');
    if (gameScores.length >= 25) await checkAndInsert('Arcade Legends', '25 games played! You two are on fire! 🔥', 'game');

    return unlocked;
  },

  // --- Mini-Games Score System ---
  saveGameScore: async (coupleId: string, userId: string, gameName: string, score: number): Promise<GameScore> => {
    const { data, error } = await supabase
      .from('game_scores')
      .insert({ couple_id: coupleId, user_id: userId, game_name: gameName, score })
      .select()
      .single();
    if (error) throw error;
    // Non-blocking achievement check
    db.checkAndUnlockAchievements(coupleId).catch(console.error);
    return data;
  },

  getGameScores: async (coupleId: string): Promise<GameScore[]> => {
    const { data, error } = await supabase
      .from('game_scores')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return [];
    return data || [];
  },

  getHighScores: async (coupleId: string, gameName: string): Promise<GameScore[]> => {
    const { data, error } = await supabase
      .from('game_scores')
      .select('*')
      .eq('couple_id', coupleId)
      .eq('game_name', gameName)
      .order('score', { ascending: false })
      .limit(10);
    if (error) return [];
    return data || [];
  }
};

async function hashPin(pin: string): Promise<string> {
  if (typeof window === 'undefined') return pin;
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
