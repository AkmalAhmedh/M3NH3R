'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/db';
import { Profile, Couple } from '../types';
import { User } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  profile: Profile | null;
  partnerProfile: Profile | null;
  couple: Couple | null;
  loading: boolean;
  refreshState: () => Promise<void>;
  logOut: () => Promise<void>;
  updateMood: (mood: string, emoji: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndCouple = React.useCallback(async (userId: string, userEmail?: string) => {
    try {
      let myProfile = await db.getCurrentProfile(userId);
      
      // If no profile exists and user email is provided, create one
      if (!myProfile && userEmail) {
        try {
          myProfile = await db.createProfile(userId, userEmail);
        } catch (createErr) {
          console.error('Error creating profile:', createErr);
          // Profile creation failed - this is a critical error
          // The profile fetch should also fail in this case since no profile exists
          setProfile(null);
          return;
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
      } else {
        // No profile found and couldn't create one
        setProfile(null);
        setCouple(null);
        setPartnerProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile and couple info:', err);
      setProfile(null);
      setCouple(null);
      setPartnerProfile(null);
    }
  }, []);

  const refreshState = React.useCallback(async () => {
    if (user) {
      await fetchProfileAndCouple(user.id);
    }
  }, [user, fetchProfileAndCouple]);

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
    try {
      // Wrap in Promise.race to prevent hanging if realtime channels refuse to close
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setPartnerProfile(null);
      setCouple(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Safety timeout to prevent infinite loading screen
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // 1. Supabase Session Listener
    const initializeUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Auth session fetch failed:', error);
          await supabase.auth.signOut();
          setUser(null);
        } else if (session) {
          setUser(session.user);
          await fetchProfileAndCouple(session.user.id, session.user.email);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        await supabase.auth.signOut();
        setUser(null);
      } finally {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    initializeUser();

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
      clearTimeout(safetyTimer);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [fetchProfileAndCouple]);

  // Listen to updates on the current user's profile to detect when they are linked by their partner
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        async (payload) => {
          const updatedProfile = payload.new as Profile;
          if (updatedProfile && updatedProfile.couple_id) {
            await fetchProfileAndCouple(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Real-time synchronization subscription for profiles/notifications
  useEffect(() => {
    if (!profile?.couple_id) return;

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
  }, [profile?.couple_id, profile?.id]);

  return (
    <AppContext.Provider value={{
      user,
      profile,
      partnerProfile,
      couple,
      loading,
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
