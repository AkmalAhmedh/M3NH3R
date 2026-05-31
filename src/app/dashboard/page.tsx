'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, Calendar, Smile, Compass, Edit3, Film, Gamepad2, 
  MapPin, Sparkles, Bell, Trophy, BookOpen 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';
import { Memory, Drawing, Movie, Game, LocationLog, AppNotification, Achievement } from '@/types';

// Mood Ring options
const MOOD_OPTIONS = [
  { emoji: '🥰', label: 'Affectionate', color: 'from-pink-500 to-rose-500' },
  { emoji: '🎮', label: 'Gaming', color: 'from-purple-500 to-indigo-500' },
  { emoji: '😴', label: 'Tired', color: 'from-blue-700 to-slate-700' },
  { emoji: '🔋', label: 'Low Energy', color: 'from-amber-600 to-orange-700' },
  { emoji: '😊', label: 'Happy', color: 'from-yellow-400 to-amber-500' },
  { emoji: '😔', label: 'Sad', color: 'from-sky-700 to-blue-800' },
  { emoji: '🤗', label: 'Need Attention', color: 'from-rose-400 to-pink-500' },
  { emoji: '🎉', label: 'Excited', color: 'from-emerald-400 to-teal-500' },
];

const DATE_IDEAS = [
  { text: '📽️ Movie Night', desc: 'Pop some popcorn and snuggle up.' },
  { text: '🎮 Co-op Gaming Session', desc: 'Beat a boss or race in Mario Kart.' },
  { text: '☕ Cozy Cafe Date', desc: 'Grab lattes and talk for hours.' },
  { text: '🍕 Pizza & Doodles', desc: 'Order a pie and draw on canvas.' },
  { text: '🌊 Sunset Beach Visit', desc: 'Walk along the shore together.' },
  { text: '🍳 Cook Dinner Together', desc: 'Try a brand new recipe.' },
  { text: '⭐ Star Gazing Night', desc: 'Lie down under the night sky.' }
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, partnerProfile, couple, loading, updateMood, isDemo } = useApp();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Slot machine state
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotIndex, setSlotIndex] = useState(0);
  const [selectedIdea, setSelectedIdea] = useState<typeof DATE_IDEAS[0] | null>(null);

  // Redirect if not logged in or not linked
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!profile?.couple_id) {
        router.push('/onboarding');
      }
    }
  }, [user, profile, loading, router]);

  // Load dashboard widgets data
  const loadDashboardData = useCallback(async () => {
    if (!profile?.couple_id) return;
    try {
      const mems = await db.getMemories(profile.couple_id);
      setMemories(mems);
      const drws = await db.getDrawings(profile.couple_id);
      setDrawings(drws);
      const movs = await db.getMovies(profile.couple_id);
      setMovies(movs);
      const gms = await db.getGames(profile.couple_id);
      setGames(gms);
      const achs = await db.getAchievements(profile.couple_id);
      setAchievements(achs);

      const notifs = await db.getNotifications(profile.couple_id, profile.id);
      setNotifications(notifs);
    } catch (err) {
      console.error(err);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.couple_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDashboardData();
    }
  }, [profile, loadDashboardData]);

  // Refresh real-time triggers for dashboard items
  useEffect(() => {
    if (isDemo || !profile?.couple_id) return;

    // Listen to changes on memories, drawings, notifications
    const channel = supabase
      .channel(`dashboard-realtime-${profile.couple_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `couple_id=eq.${profile.couple_id}` }, () => { loadDashboardData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawings', filter: `couple_id=eq.${profile.couple_id}` }, () => { loadDashboardData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `couple_id=eq.${profile.couple_id}` }, () => { loadDashboardData(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.couple_id, isDemo]);

  // Calculate Days Together
  const getDaysTogether = () => {
    if (!couple?.anniversary_date) return 100; // default template display
    const start = new Date(couple.anniversary_date);
    const today = new Date();
    const diff = today.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  // Calculate Countdown to next anniversary
  const getAnniversaryCountdown = () => {
    if (!couple?.anniversary_date) return 365;
    const ann = new Date(couple.anniversary_date);
    const today = new Date();
    
    // Set to current year
    const nextAnn = new Date(today.getFullYear(), ann.getMonth(), ann.getDate());
    if (nextAnn.getTime() < today.getTime()) {
      nextAnn.setFullYear(today.getFullYear() + 1);
    }

    const diff = nextAnn.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Start Date Generator slot machine animation
  const spinSlotMachine = () => {
    if (slotSpinning) return;
    setSlotSpinning(true);
    setSelectedIdea(null);

    let count = 0;
    const interval = setInterval(() => {
      setSlotIndex((prev) => (prev + 1) % DATE_IDEAS.length);
      count++;

      if (count > 15) {
        clearInterval(interval);
        // Final random pick
        const finalIdx = Math.floor(Math.random() * DATE_IDEAS.length);
        setSlotIndex(finalIdx);
        setSelectedIdea(DATE_IDEAS[finalIdx]);
        setSlotSpinning(false);
      }
    }, 100);
  };

  const handleMarkNotifications = async () => {
    if (!profile?.couple_id) return;
    await db.markNotificationsRead(profile.couple_id, profile.id);
    setNotifications([]);
  };

  if (loading || !profile || !couple) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="text-center space-y-3">
          <Compass className="w-10 h-10 text-brand-violet animate-spin-slow mx-auto" />
          <p className="text-xs text-slate-400 uppercase tracking-widest">Opening Universe command deck...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between pb-32">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-brand-violet/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-brand-cyan/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-6 pt-10 space-y-8 z-10">
        
        {/* Header Widget */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-gradient-to-tr from-brand-violet to-brand-fuchsia rounded-full flex items-center justify-center text-white shadow-lg shadow-brand-violet/20">
              <Heart className="w-6 h-6 fill-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {profile.username} <span className="text-slate-500 font-light">&</span> {partnerProfile?.username || 'Partner'}
              </h1>
              <p className="text-slate-400 text-xs tracking-wider uppercase">Shared Universe</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-4 w-full md:w-auto"
          >
            {/* Days Together */}
            <div className="glass p-4 rounded-xl flex-1 md:flex-none text-center min-w-[120px]">
              <span className="block text-2xl font-black text-glow-fuchsia text-brand-fuchsia">{getDaysTogether()}</span>
              <span className="text-[10px] uppercase text-slate-400 tracking-wider font-light">Days Bound</span>
            </div>

            {/* Anniversary Countdown */}
            <div className="glass p-4 rounded-xl flex-1 md:flex-none text-center min-w-[120px]">
              <span className="block text-2xl font-black text-glow-cyan text-brand-cyan">{getAnniversaryCountdown()}</span>
              <span className="text-[10px] uppercase text-slate-400 tracking-wider font-light">Anniversary Countdown</span>
            </div>
          </motion.div>
        </section>

        {/* Mood Ring & Collaborative Space Row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mood Ring (My Mood) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-6 rounded-2xl flex flex-col justify-between border border-white/5 relative"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
                  <Smile className="w-4 h-4 text-brand-fuchsia" /> My Mood Ring
                </h2>
                <span className="text-xs bg-brand-violet/10 text-brand-violet px-2.5 py-0.5 rounded-full border border-brand-violet/20 font-mono">
                  {profile.mood || 'Set Status'}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                {MOOD_OPTIONS.map((mood) => {
                  const isSelected = profile.mood === mood.label;
                  return (
                    <button
                      key={mood.label}
                      onClick={() => updateMood(mood.label, mood.emoji)}
                      className={`text-2xl p-2.5 rounded-xl transition duration-200 cursor-pointer flex justify-center items-center relative ${
                        isSelected 
                          ? `bg-gradient-to-tr ${mood.color} text-white shadow-lg` 
                          : 'bg-white/5 border border-white/5 hover:bg-white/10'
                      }`}
                      title={mood.label}
                    >
                      {mood.emoji}
                      {isSelected && (
                        <motion.div
                          layoutId="mood-ring-active"
                          className="absolute -inset-1 border border-white/30 rounded-xl"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Mood Ring (Partner Mood) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass p-6 rounded-2xl flex flex-col justify-between border border-white/5"
          >
            <div>
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2 mb-4">
                <Smile className="w-4 h-4 text-brand-cyan" /> Partner Mood Ring
              </h2>
              {partnerProfile ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <div className="text-6xl animate-float">
                    {partnerProfile.mood_emoji || '🪐'}
                  </div>
                  <div className="text-center">
                    <span className="block text-base font-bold text-slate-200">
                      {partnerProfile.username} is feeling
                    </span>
                    <span className="text-xs text-brand-cyan tracking-wider font-semibold font-mono">
                      {partnerProfile.mood || 'Celestial Ambient'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">
                  Waiting for partner link...
                </div>
              )}
            </div>
          </motion.div>

          {/* Random Date Generator Slot Machine */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass p-6 rounded-2xl border border-white/5 flex flex-col justify-between"
          >
            <div>
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-brand-gold" /> Random Date Slot Machine
              </h2>
              
              <div className="bg-slate-950/80 border border-white/5 rounded-xl p-4 min-h-[90px] flex flex-col justify-center items-center relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slotIndex}
                    initial={{ y: slotSpinning ? 20 : 0, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: slotSpinning ? -20 : 0, opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="text-center"
                  >
                    <span className="text-base font-semibold block text-slate-200">
                      {DATE_IDEAS[slotIndex].text}
                    </span>
                  </motion.div>
                </AnimatePresence>
                {selectedIdea && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-slate-400 mt-1 block"
                  >
                    {selectedIdea.desc}
                  </motion.span>
                )}
              </div>
            </div>

            <button
              onClick={spinSlotMachine}
              disabled={slotSpinning}
              className="mt-4 w-full py-2.5 bg-gradient-to-r from-brand-gold to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition duration-300 cursor-pointer disabled:opacity-50"
            >
              {slotSpinning ? 'Spining...' : 'Spin for Date Activity'}
            </button>
          </motion.div>
        </section>

        {/* Dashboard Stat Overview Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/galaxy" className="glass p-5 rounded-xl border border-white/5 hover:border-brand-violet/30 transition flex flex-col items-center justify-center text-center">
            <Compass className="w-6 h-6 text-brand-violet mb-2" />
            <span className="block text-xl font-bold font-mono">{memories.length}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">Memory Stars</span>
          </Link>

          <Link href="/canvas" className="glass p-5 rounded-xl border border-white/5 hover:border-brand-fuchsia/30 transition flex flex-col items-center justify-center text-center">
            <Edit3 className="w-6 h-6 text-brand-fuchsia mb-2" />
            <span className="block text-xl font-bold font-mono">{drawings.length}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">Drawings Pinned</span>
          </Link>

          <Link href="/journal" className="glass p-5 rounded-xl border border-white/5 hover:border-brand-cyan/30 transition flex flex-col items-center justify-center text-center">
            <BookOpen className="w-6 h-6 text-brand-cyan mb-2" />
            <span className="block text-xl font-bold font-mono">{movies.length}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">Popcorn Tracker</span>
          </Link>

          <div className="glass p-5 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
            <Trophy className="w-6 h-6 text-brand-gold mb-2" />
            <span className="block text-xl font-bold font-mono">{achievements.length}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">Achievements</span>
          </div>
        </section>

        {/* Bottom row: Refrigerator pinned doodles and Notifications */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Refrigerator Pinned drawings */}
          <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-fuchsia" /> Refrigerator Door
              </h2>
              <Link href="/canvas" className="text-[10px] text-brand-fuchsia hover:underline">Go Draw</Link>
            </div>
            
            <div className="bg-slate-900/50 rounded-xl p-4 min-h-[160px] flex items-center justify-center border border-white/5">
              {drawings.find(d => d.is_pinned) ? (
                <div className="text-center">
                  <div className="fridge-pin inline-block bg-white text-slate-950 p-2 scale-90 -rotate-3 transition hover:rotate-0 hover:scale-100 duration-300">
                    <img 
                      src={drawings.find(d => d.is_pinned)?.thumbnail_url || ''} 
                      alt="Pinned Doodle" 
                      className="max-h-[140px] max-w-[200px] object-contain rounded"
                    />
                    <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">
                      {drawings.find(d => d.is_pinned)?.name || 'Doodle'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500">
                  No doodles pinned yet. Draw something on Live Canvas and pin it to the Refrigerator!
                </div>
              )}
            </div>
          </div>

          {/* Real-time Notifications log */}
          <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-cyan" /> Constellation Signals
              </h2>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkNotifications}
                  className="text-[10px] text-brand-cyan hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="bg-slate-900/50 rounded-xl p-3 min-h-[160px] max-h-[160px] overflow-y-auto space-y-2 border border-white/5">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} className="p-2 bg-white/5 rounded-lg border border-white/5 text-xs text-slate-300">
                    {notif.message}
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-center text-xs text-slate-500">
                  No new celestial signals from your partner.
                </div>
              )}
            </div>
          </div>

        </section>

      </main>

      {/* Shared navigation menu overlay */}
      <Navbar />
    </div>
  );
}
