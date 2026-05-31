'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { db, initLocalDB } from '../lib/db';
import { Profile, Couple } from '../types';
import { User } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  profile: Profile | null;
  partnerProfile: Profile | null;
  couple: Couple | null;
  loading: boolean;
  isDemo: boolean;
  refreshState: () => Promise<void>;
  logOut: () => Promise<void>;
  updateMood: (mood: string, emoji: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('universe_session_user');
      if (savedUser) {
        try {
          return JSON.parse(savedUser) as User;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo] = useState(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('universe_force_demo') === 'true') {
        return true;
      }
    }
    const effectiveSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !(!!effectiveSupabaseUrl && effectiveSupabaseUrl !== 'https://placeholder-url-for-build.supabase.co');
  });

  const fetchProfileAndCouple = async (userId: string, userEmail?: string) => {
    try {
      let myProfile = await db.getCurrentProfile(userId);
      
      // If no profile exists and user email is provided, create one
      if (!myProfile && userEmail) {
        try {
          myProfile = await db.createProfile(userId, userEmail);
        } catch (createErr) {
          console.error('Error creating profile:', createErr);
        }
      }
      
      if (myProfile) {
        setProfile(myProfile);
        if (myProfile.couple_id) {
          const myCouple = await db.getCouple(myProfile.couple_id);
          setCouple(myCouple);
          const myPartner = await db.getPartnerProfile(myProfile.couple_id, userId);
          setPartnerProfile(myPartner);
        } else {
          setCouple(null);
          setPartnerProfile(null);
        }
      }
    } catch (err) {
      console.error('Error fetching profile and couple info:', err);
    }
  };

  const refreshState = async () => {
    if (user) {
      await fetchProfileAndCouple(user.id);
    }
  };

  const updateMood = async (mood: string, emoji: string) => {
    if (profile) {
      const updated = await db.updateProfileMood(profile.id, mood, emoji);
      if (updated) {
        setProfile(updated);
        // Refresh partner profile too
        if (profile.couple_id) {
          const myPartner = await db.getPartnerProfile(profile.couple_id, profile.id);
          setPartnerProfile(myPartner);
        }
      }
    }
  };

  const logOut = async () => {
    setLoading(true);
    if (!isDemo) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('universe_session_user');
    }
    setUser(null);
    setProfile(null);
    setPartnerProfile(null);
    setCouple(null);
    setLoading(false);
  };

  useEffect(() => {
    // Initialise Local Storage DB fallback
    initLocalDB();

    if (!isDemo) {
      // 1. Supabase Session Listener
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setUser(session.user);
          fetchProfileAndCouple(session.user.id, session.user.email).then(() => setLoading(false));
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          setUser(session.user);
          await fetchProfileAndCouple(session.user.id, session.user.email);
        } else {
          setUser(null);
          setProfile(null);
          setPartnerProfile(null);
          setCouple(null);
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // 2. Demo Local Storage Session listener
      if (user) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProfileAndCouple(user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [isDemo, user]);

  // Real-time synchronization subscription for profiles/notifications
  useEffect(() => {
    if (isDemo || !profile?.couple_id) return;

    // Realtime channel for couple-level updates (moods, active partner)
    const channel = supabase
      .channel(`couple-sync-${profile.couple_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `couple_id=eq.${profile.couple_id}`
        },
        async () => {
          // Re-fetch profiles to update app state
          await fetchProfileAndCouple(profile.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.couple_id, profile?.id, isDemo]);

  return (
    <AppContext.Provider value={{
      user,
      profile,
      partnerProfile,
      couple,
      loading,
      isDemo,
      refreshState,
      logOut,
      updateMood
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
