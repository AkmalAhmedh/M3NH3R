import { supabase } from './supabaseClient';
import { 
  Profile, Couple, InviteCode, BreakupRequest, Memory, MemoryAsset, 
  SandboxCard, Drawing, MoodLog, Want, Movie, Game, LocationLog, 
  JournalEntry, VoiceCapsule, LoveLetter, TimeCapsule, AppNotification, 
  Achievement, SafeSpace 
} from '../types';

const IS_SUPABASE_CONNECTED = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-url-for-build.supabase.co';

// Helper for local storage mock DB
class LocalDB {
  static get<T>(table: string): T[] {
    if (typeof window === 'undefined') return [];
    const val = localStorage.getItem(`universe_db_${table}`);
    return val ? JSON.parse(val) : [];
  }

  static set<T>(table: string, data: T[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`universe_db_${table}`, JSON.stringify(data));
  }

  static insert<T>(table: string, row: T): void {
    const rows = this.get<T>(table);
    rows.push(row);
    this.set(table, rows);
  }

  static update<T extends { id: string }>(table: string, id: string, updates: Partial<T>): T | null {
    const rows = this.get<T>(table);
    const idx = rows.findIndex(r => r.id === id);
    if (idx !== -1) {
      rows[idx] = { ...rows[idx], ...updates };
      this.set(table, rows);
      return rows[idx];
    }
    return null;
  }

  static delete<T extends { id: string }>(table: string, id: string): void {
    const rows = this.get<T>(table);
    const filtered = rows.filter(r => r.id !== id);
    this.set(table, filtered);
  }
}

// Initialise Local Storage with dummy data if empty
export function initLocalDB() {
  if (typeof window === 'undefined') return;
  
  if (!localStorage.getItem('universe_db_profiles')) {
    // We will populate user records dynamically when signing in / registering.
    LocalDB.set('profiles', []);
    LocalDB.set('couples', []);
    LocalDB.set('invite_codes', []);
    LocalDB.set('memories', []);
    LocalDB.set('sandbox_cards', [
      {
        id: 'sandbox-1',
        couple_id: 'couple-1',
        title: 'See the Northern Lights',
        status: 'wishlist',
        category: 'Travel',
        metadata: { notes: 'A dream we must fulfill!' },
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'sandbox-2',
        couple_id: 'couple-1',
        title: 'Finish Coop Campaign in Portal 2',
        status: 'right_now',
        category: 'Game',
        metadata: { notes: 'Currently stuck on chamber 4' },
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'sandbox-3',
        couple_id: 'couple-1',
        title: 'Our First Picnic',
        status: 'core_memories',
        category: 'Date',
        metadata: { notes: 'At Central Park, the weather was perfect.', date: '2026-04-12' },
        order_index: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]);
    LocalDB.set('drawings', []);
    LocalDB.set('mood_logs', []);
    LocalDB.set('wants', []);
    LocalDB.set('movies', []);
    LocalDB.set('games', []);
    LocalDB.set('locations', []);
    LocalDB.set('journals', []);
    LocalDB.set('voice_capsules', []);
    LocalDB.set('love_letters', []);
    LocalDB.set('time_capsules', []);
    LocalDB.set('notifications', []);
    LocalDB.set('achievements', [
      {
        id: 'ach-1',
        couple_id: 'couple-1',
        name: 'The Big Bang',
        description: 'Successfully initialized your shared universe.',
        unlocked_at: new Date().toISOString(),
        criteria_type: 'linking',
        created_at: new Date().toISOString()
      }
    ]);
  }
}

// ----------------------------------------------------
// DB INTERFACE EXPORTS
// ----------------------------------------------------

export const db = {
  isSupabase: () => !!IS_SUPABASE_CONNECTED,

  // --- Profile / Auth Helpers ---
  getCurrentProfile: async (userId: string): Promise<Profile | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) return null;
      return data;
    } else {
      const profiles = LocalDB.get<Profile>('profiles');
      return profiles.find(p => p.id === userId) || null;
    }
  },

  getPartnerProfile: async (coupleId: string, myId: string): Promise<Profile | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('couple_id', coupleId)
        .neq('id', myId)
        .maybeSingle();
      if (error) return null;
      return data;
    } else {
      const profiles = LocalDB.get<Profile>('profiles');
      return profiles.find(p => p.couple_id === coupleId && p.id !== myId) || null;
    }
  },

  updateProfileMood: async (userId: string, mood: string, emoji: string): Promise<Profile | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ mood, mood_emoji: emoji, last_active_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      
      // Also log mood history
      await supabase.from('mood_logs').insert({ user_id: userId, mood, mood_emoji: emoji });
      return data;
    } else {
      const updated = LocalDB.update<Profile>('profiles', userId, { mood, mood_emoji: emoji, last_active_at: new Date().toISOString() });
      LocalDB.insert<MoodLog>('mood_logs', {
        id: Math.random().toString(),
        user_id: userId,
        mood,
        mood_emoji: emoji,
        notes: '',
        created_at: new Date().toISOString()
      });
      return updated;
    }
  },

  getMoodHistory: async (coupleId: string): Promise<MoodLog[]> => {
    if (IS_SUPABASE_CONNECTED) {
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
    } else {
      const logs = LocalDB.get<MoodLog>('mood_logs');
      const profiles = LocalDB.get<Profile>('profiles');
      const coupleUserIds = profiles.filter(p => p.couple_id === coupleId).map(p => p.id);
      return logs
        .filter(l => coupleUserIds.includes(l.user_id))
        .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);
    }
  },

  // --- Partner Linking System ---
  generateInviteCode: async (userId: string): Promise<string> => {
    const code = `STAR-${Math.floor(1000 + Math.random() * 9000)}`;
    if (IS_SUPABASE_CONNECTED) {
      const { error } = await supabase
        .from('invite_codes')
        .insert({ code, issuer_id: userId });
      if (error) throw error;
      return code;
    } else {
      LocalDB.insert<InviteCode>('invite_codes', {
        id: Math.random().toString(),
        code,
        issuer_id: userId,
        is_used: false,
        created_at: new Date().toISOString()
      });
      return code;
    }
  },

  getInviteCode: async (userId: string): Promise<string | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('code')
        .eq('issuer_id', userId)
        .eq('is_used', false)
        .maybeSingle();
      if (error || !data) return null;
      return data.code;
    } else {
      const codes = LocalDB.get<InviteCode>('invite_codes');
      const active = codes.find(c => c.issuer_id === userId && !c.is_used);
      return active ? active.code : null;
    }
  },

  linkPartner: async (myId: string, inviteCode: string): Promise<Couple> => {
    if (IS_SUPABASE_CONNECTED) {
      // 1. Verify code
      const { data: codeData, error: codeErr } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode)
        .eq('is_used', false)
        .single();
      
      if (codeErr || !codeData) throw new Error('Invalid or expired code.');
      if (codeData.issuer_id === myId) throw new Error('You cannot link with your own code.');

      // 2. Create Couple
      const { data: coupleData, error: coupleErr } = await supabase
        .from('couples')
        .insert({ name: 'Our Shared Universe', anniversary_date: new Date().toISOString().split('T')[0] })
        .select()
        .single();
      
      if (coupleErr || !coupleData) throw coupleErr || new Error('Failed to create couple.');

      // 3. Update profiles for both partners
      await supabase.from('profiles').update({ couple_id: coupleData.id }).eq('id', myId);
      await supabase.from('profiles').update({ couple_id: coupleData.id }).eq('id', codeData.issuer_id);

      // 4. Mark code as used
      await supabase.from('invite_codes').update({ is_used: true }).eq('id', codeData.id);

      // 5. Send Notification
      await supabase.from('notifications').insert({
        couple_id: coupleData.id,
        recipient_id: codeData.issuer_id,
        sender_id: myId,
        type: 'link',
        message: 'Partner connected! Your universe has been established.'
      });

      return coupleData;
    } else {
      const codes = LocalDB.get<InviteCode>('invite_codes');
      const codeData = codes.find(c => c.code === inviteCode && !c.is_used);
      if (!codeData) throw new Error('Invalid or expired code.');
      if (codeData.issuer_id === myId) throw new Error('You cannot link with your own code.');

      const couple: Couple = {
        id: `couple-${Math.floor(Math.random() * 100000)}`,
        name: 'Our Shared Universe',
        anniversary_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      LocalDB.insert<Couple>('couples', couple);
      LocalDB.update<Profile>('profiles', myId, { couple_id: couple.id });
      LocalDB.update<Profile>('profiles', codeData.issuer_id, { couple_id: couple.id });

      // mark code used
      codeData.is_used = true;
      LocalDB.set('invite_codes', codes);

      // Insert linking notifications
      LocalDB.insert<AppNotification>('notifications', {
        id: Math.random().toString(),
        couple_id: couple.id,
        recipient_id: codeData.issuer_id,
        sender_id: myId,
        type: 'link',
        message: 'Partner connected! Your universe has been established.',
        is_read: false,
        metadata: {},
        created_at: new Date().toISOString()
      });

      return couple;
    }
  },

  getCouple: async (coupleId: string): Promise<Couple | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('couples')
        .select('*')
        .eq('id', coupleId)
        .single();
      if (error) return null;
      return data;
    } else {
      const couples = LocalDB.get<Couple>('couples');
      return couples.find(c => c.id === coupleId) || null;
    }
  },

  updateAnniversary: async (coupleId: string, date: string): Promise<Couple | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('couples')
        .update({ anniversary_date: date })
        .eq('id', coupleId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      return LocalDB.update<Couple>('couples', coupleId, { anniversary_date: date });
    }
  },

  // --- Breakup Consent System ---
  initiateBreakup: async (coupleId: string, myId: string): Promise<BreakupRequest> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('breakup_requests')
        .insert({ couple_id: coupleId, initiator_id: myId, status: 'pending' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const request: BreakupRequest = {
        id: Math.random().toString(),
        couple_id: coupleId,
        initiator_id: myId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      LocalDB.insert<BreakupRequest>('breakup_requests', request);
      return request;
    }
  },

  getBreakupRequest: async (coupleId: string): Promise<BreakupRequest | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('breakup_requests')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('status', 'pending')
        .maybeSingle();
      if (error) return null;
      return data;
    } else {
      const reqs = LocalDB.get<BreakupRequest>('breakup_requests');
      return reqs.find(r => r.couple_id === coupleId && r.status === 'pending') || null;
    }
  },

  respondToBreakup: async (requestId: string, accept: boolean, coupleId: string): Promise<void> => {
    const status = accept ? 'accepted' : 'declined';
    if (IS_SUPABASE_CONNECTED) {
      await supabase
        .from('breakup_requests')
        .update({ status })
        .eq('id', requestId);

      if (accept) {
        // Mutual consent reached! Reset couple_id for both profiles to null
        await supabase
          .from('profiles')
          .update({ couple_id: null, mood: null, mood_emoji: null })
          .eq('couple_id', coupleId);
      }
    } else {
      const reqs = LocalDB.get<BreakupRequest>('breakup_requests');
      const idx = reqs.findIndex(r => r.id === requestId);
      if (idx !== -1) {
        reqs[idx].status = status;
        LocalDB.set('breakup_requests', reqs);
      }
      if (accept) {
        const profiles = LocalDB.get<Profile>('profiles');
        profiles.forEach(p => {
          if (p.couple_id === coupleId) {
            p.couple_id = null;
            p.mood = null;
            p.mood_emoji = null;
          }
        });
        LocalDB.set('profiles', profiles);
      }
    }
  },

  // --- Memories & Star System ---
  getMemories: async (coupleId: string): Promise<Memory[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('memories')
        .select('*, memory_assets(*)')
        .eq('couple_id', coupleId)
        .order('date', { ascending: false });
      if (error) return [];
      return data || [];
    } else {
      const memories = LocalDB.get<Memory>('memories');
      const assets = LocalDB.get<MemoryAsset>('memory_assets');
      return memories
        .filter(m => m.couple_id === coupleId)
        .map(m => ({
          ...m,
          assets: assets.filter(a => a.memory_id === m.id)
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
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
    if (IS_SUPABASE_CONNECTED) {
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

      // Add achievement checks
      await db.checkAndUnlockAchievements(coupleId);

      return memory;
    } else {
      const memory: Memory = {
        id: `memory-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        title,
        content,
        category,
        date,
        created_by: userId,
        created_at: new Date().toISOString()
      };

      LocalDB.insert<Memory>('memories', memory);

      if (filePaths && filePaths.length > 0) {
        filePaths.forEach(f => {
          LocalDB.insert<MemoryAsset>('memory_assets', {
            id: Math.random().toString(),
            memory_id: memory.id,
            file_path: f.path,
            file_type: f.type,
            created_at: new Date().toISOString()
          });
        });
      }

      await db.checkAndUnlockAchievements(coupleId);
      return memory;
    }
  },

  // --- Sandbox & Wishlist ---
  getSandboxCards: async (coupleId: string): Promise<SandboxCard[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('sandbox_cards')
        .select('*')
        .eq('couple_id', coupleId)
        .order('order_index', { ascending: true });
      if (error) return [];
      return data || [];
    } else {
      const cards = LocalDB.get<SandboxCard>('sandbox_cards');
      return cards.filter(c => c.couple_id === coupleId).sort((a,b) => a.order_index - b.order_index);
    }
  },

  createSandboxCard: async (coupleId: string, title: string, status: SandboxCard['status'], category: string, metadata: any): Promise<SandboxCard> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('sandbox_cards')
        .insert({ couple_id: coupleId, title, status, category, metadata })
        .select()
        .single();
      if (error || !data) throw error || new Error('Failed to create sandbox card.');
      return data;
    } else {
      const card: SandboxCard = {
        id: `sandbox-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        title,
        status,
        category,
        metadata: metadata || {},
        order_index: LocalDB.get<SandboxCard>('sandbox_cards').length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      LocalDB.insert<SandboxCard>('sandbox_cards', card);
      return card;
    }
  },

  updateSandboxCardStatus: async (cardId: string, status: SandboxCard['status'], metadataUpdates?: any): Promise<SandboxCard> => {
    if (IS_SUPABASE_CONNECTED) {
      // If moving to Core Memories, we check if metadata updates are provided
      const updates: any = { status };
      if (metadataUpdates) {
        updates.metadata = metadataUpdates;
      }
      const { data, error } = await supabase
        .from('sandbox_cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();
      if (error || !data) throw error || new Error('Failed to update sandbox card.');

      // If moved to core memory, create a memory star automatically
      if (status === 'core_memories') {
        const paths = data.metadata.photoUrl ? [{ path: data.metadata.photoUrl, type: 'image' as const }] : [];
        await db.addMemory(
          data.couple_id, 
          'system', // system created on move
          data.title, 
          data.metadata.notes || 'Moved from Wishlist into Core Memories!', 
          (data.category as any) || 'Personal', 
          data.metadata.date || new Date().toISOString().split('T')[0],
          paths
        );
      }

      return data;
    } else {
      const oldCard = LocalDB.get<SandboxCard>('sandbox_cards').find(c => c.id === cardId);
      const metadata = oldCard ? { ...oldCard.metadata, ...metadataUpdates } : (metadataUpdates || {});
      const updated = LocalDB.update<SandboxCard>('sandbox_cards', cardId, { status, metadata, updated_at: new Date().toISOString() });
      
      if (updated && status === 'core_memories') {
        const paths = updated.metadata.photoUrl ? [{ path: updated.metadata.photoUrl, type: 'image' as const }] : [];
        await db.addMemory(
          updated.couple_id,
          'system',
          updated.title,
          updated.metadata.notes || 'Moved from Wishlist into Core Memories!',
          (updated.category as any) || 'Personal',
          updated.metadata.date || new Date().toISOString().split('T')[0],
          paths
        );
      }
      return updated!;
    }
  },

  deleteSandboxCard: async (cardId: string): Promise<void> => {
    if (IS_SUPABASE_CONNECTED) {
      await supabase.from('sandbox_cards').delete().eq('id', cardId);
    } else {
      LocalDB.delete<SandboxCard>('sandbox_cards', cardId);
    }
  },

  // --- Wants (His / Her Preferences) ---
  getWants: async (coupleId: string): Promise<Want[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('wants')
        .select('*')
        .eq('couple_id', coupleId);
      if (error) return [];
      return data || [];
    } else {
      const wants = LocalDB.get<Want>('wants');
      return wants.filter(w => w.couple_id === coupleId);
    }
  },

  addWant: async (coupleId: string, userId: string, content: string, category: Want['category'], isSensitive: boolean): Promise<Want> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('wants')
        .insert({ couple_id: coupleId, user_id: userId, content, category, is_sensitive: isSensitive })
        .select()
        .single();
      if (error || !data) throw error;
      return data;
    } else {
      const want: Want = {
        id: `want-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        user_id: userId,
        content,
        category,
        is_sensitive: isSensitive,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<Want>('wants', want);
      return want;
    }
  },

  deleteWant: async (wantId: string): Promise<void> => {
    if (IS_SUPABASE_CONNECTED) {
      await supabase.from('wants').delete().eq('id', wantId);
    } else {
      LocalDB.delete<Want>('wants', wantId);
    }
  },

  // --- Collaborative Drawing Canvas ---
  getDrawings: async (coupleId: string): Promise<Drawing[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('couple_id', coupleId)
        .order('updated_at', { ascending: false });
      if (error) return [];
      return data || [];
    } else {
      const drawings = LocalDB.get<Drawing>('drawings');
      return drawings.filter(d => d.couple_id === coupleId).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
  },

  saveDrawing: async (coupleId: string, userId: string, name: string, canvasData: any, thumbnailUrl?: string, isPinned = false): Promise<Drawing> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('drawings')
        .insert({ couple_id: coupleId, name, canvas_data: canvasData, thumbnail_url: thumbnailUrl, is_pinned: isPinned, created_by: userId })
        .select()
        .single();
      if (error || !data) throw error;
      return data;
    } else {
      const drawing: Drawing = {
        id: `drawing-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        name,
        canvas_data: canvasData,
        thumbnail_url: thumbnailUrl || null,
        is_pinned: isPinned,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      LocalDB.insert<Drawing>('drawings', drawing);
      return drawing;
    }
  },

  pinDrawing: async (drawingId: string, pin: boolean): Promise<Drawing | null> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('drawings')
        .update({ is_pinned: pin })
        .eq('id', drawingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      return LocalDB.update<Drawing>('drawings', drawingId, { is_pinned: pin });
    }
  },

  // --- Trackers: Popcorn, Games, Locations ---
  getMovies: async (coupleId: string): Promise<Movie[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase.from('movies').select('*').eq('couple_id', coupleId).order('watched_at', { ascending: false });
      return data || [];
    } else {
      return LocalDB.get<Movie>('movies').filter(m => m.couple_id === coupleId).sort((a,b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime());
    }
  },

  addMovie: async (coupleId: string, title: string, type: string, rating: number, review: string, posterUrl: string, watchedAt: string): Promise<Movie> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('movies')
        .insert({ couple_id: coupleId, title, type, rating, review, poster_url: posterUrl, watched_at: watchedAt })
        .select()
        .single();
      if (error) throw error;
      await db.checkAndUnlockAchievements(coupleId);
      return data;
    } else {
      const movie: Movie = {
        id: `movie-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        title,
        type,
        rating,
        review,
        poster_url: posterUrl || null,
        watched_at: watchedAt,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<Movie>('movies', movie);
      await db.checkAndUnlockAchievements(coupleId);
      return movie;
    }
  },

  getGames: async (coupleId: string): Promise<Game[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase.from('games').select('*').eq('couple_id', coupleId).order('played_at', { ascending: false });
      return data || [];
    } else {
      return LocalDB.get<Game>('games').filter(g => g.couple_id === coupleId).sort((a,b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
    }
  },

  addGame: async (coupleId: string, title: string, hoursPlayed: number, screenshotUrl: string, notes: string, playedAt: string): Promise<Game> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('games')
        .insert({ couple_id: coupleId, title, hours_played: hoursPlayed, screenshot_url: screenshotUrl, notes, played_at: playedAt })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const game: Game = {
        id: `game-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        title,
        hours_played: hoursPlayed,
        screenshot_url: screenshotUrl || null,
        notes,
        played_at: playedAt,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<Game>('games', game);
      return game;
    }
  },

  getLocations: async (coupleId: string): Promise<LocationLog[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase.from('locations').select('*').eq('couple_id', coupleId).order('visited_at', { ascending: false });
      return data || [];
    } else {
      return LocalDB.get<LocationLog>('locations').filter(l => l.couple_id === coupleId).sort((a,b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime());
    }
  },

  addLocation: async (coupleId: string, name: string, type: LocationLog['type'], lat: number, lng: number, note: string, visitedAt: string): Promise<LocationLog> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('locations')
        .insert({ couple_id: coupleId, name, type, lat, lng, note, visited_at: visitedAt })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const loc: LocationLog = {
        id: `location-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        name,
        type,
        lat,
        lng,
        note,
        visited_at: visitedAt,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<LocationLog>('locations', loc);
      return loc;
    }
  },

  // --- Safe Space Vault (Pin Protection) ---
  checkSafeSpacePin: async (coupleId: string, pin: string): Promise<boolean> => {
    // Encrypt or compare hash. Here we use a simple SHA-256 equivalent
    const hash = await hashPin(pin);
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('safe_space')
        .select('pin_hash')
        .eq('couple_id', coupleId)
        .maybeSingle();
      if (error || !data) return false;
      return data.pin_hash === hash;
    } else {
      const spaces = LocalDB.get<SafeSpace>('safe_space');
      const space = spaces.find(s => s.couple_id === coupleId);
      return space ? space.pin_hash === hash : false;
    }
  },

  hasSafeSpacePin: async (coupleId: string): Promise<boolean> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('safe_space')
        .select('id')
        .eq('couple_id', coupleId)
        .maybeSingle();
      return !!data;
    } else {
      const spaces = LocalDB.get<SafeSpace>('safe_space');
      return spaces.some(s => s.couple_id === coupleId);
    }
  },

  setSafeSpacePin: async (coupleId: string, pin: string): Promise<void> => {
    const hash = await hashPin(pin);
    if (IS_SUPABASE_CONNECTED) {
      const { error } = await supabase
        .from('safe_space')
        .insert({ couple_id: coupleId, pin_hash: hash });
      if (error) throw error;
    } else {
      LocalDB.insert<SafeSpace>('safe_space', {
        id: Math.random().toString(),
        couple_id: coupleId,
        pin_hash: hash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  },

  // --- Shared Journal ---
  getJournals: async (coupleId: string): Promise<JournalEntry[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('couple_id', coupleId)
        .order('date', { ascending: false });
      return data || [];
    } else {
      return LocalDB.get<JournalEntry>('journals').filter(j => j.couple_id === coupleId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  },

  addJournal: async (coupleId: string, userId: string, title: string, content: string, emoji: string, date: string, audioUrl?: string): Promise<JournalEntry> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('journals')
        .insert({ couple_id: coupleId, created_by: userId, title, content, emoji, date, audio_url: audioUrl })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const entry: JournalEntry = {
        id: `journal-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        created_by: userId,
        title,
        content,
        emoji,
        date,
        audio_url: audioUrl || null,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<JournalEntry>('journals', entry);
      return entry;
    }
  },

  // --- Voice Capsules ---
  getVoiceCapsules: async (coupleId: string): Promise<VoiceCapsule[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('voice_capsules')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false });
      return data || [];
    } else {
      return LocalDB.get<VoiceCapsule>('voice_capsules').filter(v => v.couple_id === coupleId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  addVoiceCapsule: async (coupleId: string, userId: string, title: string, filePath: string, category: VoiceCapsule['category']): Promise<VoiceCapsule> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('voice_capsules')
        .insert({ couple_id: coupleId, created_by: userId, title, file_path: filePath, category })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const capsule: VoiceCapsule = {
        id: `voice-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        created_by: userId,
        title,
        file_path: filePath,
        category,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<VoiceCapsule>('voice_capsules', capsule);
      return capsule;
    }
  },

  // --- Love Letters (Unlock Date) ---
  getLoveLetters: async (coupleId: string, userId: string): Promise<LoveLetter[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('love_letters')
        .select('*')
        .eq('couple_id', coupleId);
      if (error) return [];
      
      // Filter out locked letters that are not created by me
      const today = new Date().toISOString().split('T')[0];
      return (data || []).filter(l => l.created_by === userId || l.unlock_date <= today);
    } else {
      const letters = LocalDB.get<LoveLetter>('love_letters');
      const today = new Date().toISOString().split('T')[0];
      return letters.filter(l => l.couple_id === coupleId && (l.created_by === userId || l.unlock_date <= today));
    }
  },

  addLoveLetter: async (coupleId: string, userId: string, recipientId: string, content: string, unlockDate: string): Promise<LoveLetter> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('love_letters')
        .insert({ couple_id: coupleId, created_by: userId, recipient_id: recipientId, content, unlock_date: unlockDate })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const letter: LoveLetter = {
        id: `letter-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        created_by: userId,
        recipient_id: recipientId,
        content,
        unlock_date: unlockDate,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<LoveLetter>('love_letters', letter);
      return letter;
    }
  },

  // --- Time Capsules (Countdown Lock) ---
  getTimeCapsules: async (coupleId: string, userId: string): Promise<TimeCapsule[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('time_capsules')
        .select('*')
        .eq('couple_id', coupleId);
      if (error) return [];

      const today = new Date().toISOString().split('T')[0];
      return (data || []).filter(tc => tc.created_by === userId || tc.unlock_date <= today);
    } else {
      const capsules = LocalDB.get<TimeCapsule>('time_capsules');
      const today = new Date().toISOString().split('T')[0];
      return capsules.filter(tc => tc.couple_id === coupleId && (tc.created_by === userId || tc.unlock_date <= today));
    }
  },

  addTimeCapsule: async (coupleId: string, userId: string, title: string, content: string, assetsPaths: string[], unlockDate: string): Promise<TimeCapsule> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('time_capsules')
        .insert({ couple_id: coupleId, created_by: userId, title, content, assets_paths: assetsPaths, unlock_date: unlockDate })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const capsule: TimeCapsule = {
        id: `capsule-${Math.floor(Math.random() * 100000)}`,
        couple_id: coupleId,
        created_by: userId,
        title,
        content,
        assets_paths: assetsPaths,
        unlock_date: unlockDate,
        created_at: new Date().toISOString()
      };
      LocalDB.insert<TimeCapsule>('time_capsules', capsule);
      return capsule;
    }
  },

  // --- Notifications ---
  getNotifications: async (coupleId: string, userId: string): Promise<AppNotification[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });
      return data || [];
    } else {
      const notifs = LocalDB.get<AppNotification>('notifications');
      return notifs.filter(n => n.couple_id === coupleId && n.recipient_id === userId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  markNotificationsRead: async (coupleId: string, userId: string): Promise<void> => {
    if (IS_SUPABASE_CONNECTED) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('couple_id', coupleId)
        .eq('recipient_id', userId);
    } else {
      const notifs = LocalDB.get<AppNotification>('notifications');
      notifs.forEach(n => {
        if (n.couple_id === coupleId && n.recipient_id === userId) {
          n.is_read = true;
        }
      });
      LocalDB.set('notifications', notifs);
    }
  },

  // --- Achievements Checker ---
  getAchievements: async (coupleId: string): Promise<Achievement[]> => {
    if (IS_SUPABASE_CONNECTED) {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('couple_id', coupleId)
        .order('unlocked_at', { ascending: false });
      return data || [];
    } else {
      const achs = LocalDB.get<Achievement>('achievements');
      return achs.filter(a => a.couple_id === coupleId).sort((a,b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime());
    }
  },

  checkAndUnlockAchievements: async (coupleId: string): Promise<Achievement[]> => {
    const unlocked: Achievement[] = [];
    
    // Fetch stats
    const memories = await db.getMemories(coupleId);
    const movies = await db.getMovies(coupleId);

    const checkAndInsert = async (name: string, desc: string, criteria: string) => {
      let alreadyUnlocked = false;
      
      if (IS_SUPABASE_CONNECTED) {
        const { data } = await supabase
          .from('achievements')
          .select('id')
          .eq('couple_id', coupleId)
          .eq('name', name)
          .maybeSingle();
        alreadyUnlocked = !!data;
      } else {
        const achs = LocalDB.get<Achievement>('achievements');
        alreadyUnlocked = achs.some(a => a.couple_id === coupleId && a.name === name);
      }

      if (!alreadyUnlocked) {
        const achRow = {
          couple_id: coupleId,
          name,
          description: desc,
          criteria_type: criteria,
          unlocked_at: new Date().toISOString()
        };

        if (IS_SUPABASE_CONNECTED) {
          const { data } = await supabase.from('achievements').insert(achRow).select().single();
          if (data) unlocked.push(data);
        } else {
          const newAch: Achievement = {
            id: `ach-${Math.floor(Math.random() * 100000)}`,
            ...achRow,
            created_at: new Date().toISOString()
          };
          LocalDB.insert<Achievement>('achievements', newAch);
          unlocked.push(newAch);
        }
      }
    };

    // First Date Memory
    if (memories.length > 0) {
      await checkAndInsert('First Memory', 'Recorded your very first memory star together.', 'memory');
    }
    // 5 Memories
    if (memories.length >= 5) {
      await checkAndInsert('Nebula Builders', 'Created 5 memory stars together.', 'memory');
    }
    // Popcorn Lover
    if (movies.length >= 1) {
      await checkAndInsert('Movie Night', 'Logged your first popcorn movie rating.', 'movie');
    }
    if (movies.length >= 5) {
      await checkAndInsert('Cinephiles', 'Watched and rated 5 movies or series together.', 'movie');
    }

    return unlocked;
  }
};

// Simple pin hash helper
async function hashPin(pin: string): Promise<string> {
  if (typeof window === 'undefined') return pin;
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
