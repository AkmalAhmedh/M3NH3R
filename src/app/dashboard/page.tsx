'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Smile, Compass, Edit3,
  Sparkles, Bell, Trophy, BookOpen,
  Film, Zap, Star, RefreshCw
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';
import { Memory, Drawing, Movie, AppNotification, Achievement } from '@/types';

// Mood Ring options
const MOOD_OPTIONS = [
  { emoji: '🥰', label: 'Affectionate', color: 'from-pink-500 to-rose-500', glow: 'rgba(244,63,94,0.5)' },
  { emoji: '🎮', label: 'Gaming', color: 'from-purple-500 to-indigo-500', glow: 'rgba(124,58,237,0.5)' },
  { emoji: '😴', label: 'Tired', color: 'from-blue-700 to-slate-700', glow: 'rgba(29,78,216,0.4)' },
  { emoji: '🔋', label: 'Low Energy', color: 'from-amber-600 to-orange-700', glow: 'rgba(217,119,6,0.5)' },
  { emoji: '😊', label: 'Happy', color: 'from-yellow-400 to-amber-500', glow: 'rgba(251,191,36,0.5)' },
  { emoji: '😔', label: 'Sad', color: 'from-sky-700 to-blue-800', glow: 'rgba(3,105,161,0.4)' },
  { emoji: '🤗', label: 'Need Attention', color: 'from-rose-400 to-pink-500', glow: 'rgba(251,113,133,0.5)' },
  { emoji: '🎉', label: 'Excited', color: 'from-emerald-400 to-teal-500', glow: 'rgba(16,185,129,0.5)' },
];

const DATE_IDEAS = [
  { text: '📽️ Movie Night', desc: 'Pop some popcorn and snuggle up under a blanket.' },
  { text: '🎮 Co-op Gaming Session', desc: 'Beat a boss together or race in Mario Kart.' },
  { text: '☕ Cozy Cafe Date', desc: 'Grab lattes and talk for hours about everything.' },
  { text: '🍕 Pizza & Doodles', desc: 'Order a pie and draw together on canvas.' },
  { text: '🌊 Sunset Beach Visit', desc: 'Walk along the shore and watch the horizon.' },
  { text: '🍳 Cook Dinner Together', desc: 'Try a brand new recipe as a team.' },
  { text: '⭐ Star Gazing Night', desc: 'Lie down under the night sky and dream.' },
  { text: '🎨 Art Night', desc: 'Paint or sketch portraits of each other.' },
  { text: '🧘 Yoga & Chill', desc: 'Flow through a relaxing session together.' },
];

// Animated stat card component
function StatCard({
  href, icon: Icon, count, label, color, delay = 0
}: {
  href?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  count: number;
  label: string;
  color: string;
  delay?: number;
}) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass p-5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center card-hover-lift group relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at center, ${color}15 0%, transparent 70%)` }} />
      <Icon
        className="w-6 h-6 mb-2.5 transition-transform duration-300 group-hover:scale-110"
        style={{ color, filter: `drop-shadow(0 0 8px ${color})` }}
      />
      <motion.span
        key={count}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="block text-2xl font-black font-mono tracking-tight text-white"
        style={{ textShadow: `0 0 20px ${color}60` }}
      >
        {count}
      </motion.span>
      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mt-0.5">{label}</span>
    </motion.div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, partnerProfile, couple, loading, updateMood, logOut } = useApp();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Slot machine state
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotIndex, setSlotIndex] = useState(0);
  const [selectedIdea, setSelectedIdea] = useState<typeof DATE_IDEAS[0] | null>(null);
  const [moodRipple, setMoodRipple] = useState<string | null>(null);

  // Redirect if not logged in or not linked
  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login');
      else if (!profile?.couple_id) router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  // Mood toggle with ripple
  const handleMoodToggle = (clickedMood: typeof MOOD_OPTIONS[0]) => {
    if (!profile) return;
    setMoodRipple(clickedMood.label);
    setTimeout(() => setMoodRipple(null), 600);

    let currentMoods = profile.mood ? profile.mood.split(', ').filter(Boolean) : [];
    let currentEmojis = profile.mood_emoji ? profile.mood_emoji.split(', ').filter(Boolean) : [];

    if (currentMoods.includes(clickedMood.label)) {
      currentMoods = currentMoods.filter(m => m !== clickedMood.label);
      currentEmojis = currentEmojis.filter(e => e !== clickedMood.emoji);
    } else {
      currentMoods.push(clickedMood.label);
      currentEmojis.push(clickedMood.emoji);
    }
    updateMood(currentMoods.join(', '), currentEmojis.join(', '));
  };

  const loadDashboardData = useCallback(async () => {
    if (!profile?.couple_id) return;
    try {
      const [mems, drws, movs, achs, notifs] = await Promise.all([
        db.getMemories(profile.couple_id),
        db.getDrawings(profile.couple_id),
        db.getMovies(profile.couple_id),
        db.getAchievements(profile.couple_id),
        db.getNotifications(profile.couple_id, profile.id),
      ]);
      setMemories(mems);
      setDrawings(drws);
      setMovies(movs);
      setAchievements(achs);
      setNotifications(notifs);
    } catch (err) {
      console.error(err);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.couple_id) loadDashboardData();
  }, [profile, loadDashboardData]);

  useEffect(() => {
    if (!profile?.couple_id) return;
    const channel = supabase
      .channel(`dashboard-realtime-${profile.couple_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `couple_id=eq.${profile.couple_id}` }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawings', filter: `couple_id=eq.${profile.couple_id}` }, loadDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `couple_id=eq.${profile.couple_id}` }, loadDashboardData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.couple_id, loadDashboardData]);

  const getDaysTogether = () => {
    if (!couple?.anniversary_date) return 0;
    const start = new Date(couple.anniversary_date);
    const today = new Date();
    return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const getAnniversaryCountdown = () => {
    if (!couple?.anniversary_date) return null;
    const ann = new Date(couple.anniversary_date);
    const today = new Date();
    const nextAnn = new Date(today.getFullYear(), ann.getMonth(), ann.getDate());
    if (nextAnn.getTime() < today.getTime()) nextAnn.setFullYear(today.getFullYear() + 1);
    return Math.ceil((nextAnn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const spinSlotMachine = () => {
    if (slotSpinning) return;
    setSlotSpinning(true);
    setSelectedIdea(null);
    let count = 0;
    const interval = setInterval(() => {
      setSlotIndex(prev => (prev + 1) % DATE_IDEAS.length);
      count++;
      if (count > 20) {
        clearInterval(interval);
        const finalIdx = Math.floor(Math.random() * DATE_IDEAS.length);
        setSlotIndex(finalIdx);
        setSelectedIdea(DATE_IDEAS[finalIdx]);
        setSlotSpinning(false);
      }
    }, 80);
  };

  const handleMarkNotifications = async () => {
    if (!profile?.couple_id) return;
    await db.markNotificationsRead(profile.couple_id, profile.id);
    setNotifications([]);
  };

  const daysTogether = getDaysTogether();
  const anniversaryCountdown = getAnniversaryCountdown();
  const pinnedDrawing = drawings.find(d => d.is_pinned);

  if (loading || !profile || !couple) return null;

  return (
    <div className="min-h-screen cinematic-bg text-slate-100 flex flex-col pb-32 relative">
      {/* Animated nebula background orbs */}
      <div className="fixed top-0 right-1/4 w-[600px] h-[600px] bg-brand-violet/6 rounded-full filter blur-[120px] pointer-events-none animate-nebula" />
      <div className="fixed bottom-10 left-0 w-[500px] h-[500px] bg-brand-cyan/5 rounded-full filter blur-[100px] pointer-events-none animate-nebula-2" />
      <div className="fixed top-1/2 left-1/2 w-[400px] h-[400px] bg-brand-fuchsia/4 rounded-full filter blur-[100px] pointer-events-none animate-nebula-3" />

      <main className="max-w-5xl mx-auto w-full px-4 md:px-6 pt-8 space-y-6 relative z-10">

        {/* ─── CINEMATIC HERO HEADER ─────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative glass-aurora overflow-hidden"
        >
          <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Couple identity */}
            <div className="flex items-center gap-5">
              {/* Orbit heart */}
              <div className="relative w-20 h-20 flex-shrink-0">
                {/* Outer orbit */}
                <div className="absolute inset-0 border border-brand-violet/20 rounded-full animate-orbit" />
                <div className="absolute inset-1 border border-brand-cyan/15 rounded-full animate-orbit-reverse" />
                {/* Center heart */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-tr from-brand-violet to-brand-fuchsia rounded-full flex items-center justify-center shadow-lg shadow-brand-violet/30 animate-heartbeat">
                    <Heart className="w-6 h-6 fill-white text-white" />
                  </div>
                </div>
                {/* Orbiting dots */}
                <motion.div className="absolute w-2 h-2 bg-brand-cyan rounded-full"
                  style={{ top: '0px', left: '50%', marginLeft: '-4px' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(38px) rotate(-${rotate})`}
                />
                <motion.div className="absolute w-1.5 h-1.5 bg-brand-fuchsia rounded-full"
                  style={{ top: '50%', left: '0px', marginTop: '-3px' }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                  transformTemplate={({ rotate }) => `rotate(${rotate}) translateX(36px) rotate(-${rotate})`}
                />
              </div>

              <div>
                <p className="text-[10px] text-brand-cyan tracking-[0.3em] uppercase font-semibold mb-1">
                  Shared Universe
                </p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white"
                  style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {profile.username}
                  <span className="text-brand-fuchsia mx-2 animate-heartbeat inline-block">♥</span>
                  {partnerProfile?.username || 'Partner'}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">
                    {couple.anniversary_date
                      ? `Together since ${new Date(couple.anniversary_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : 'Your story begins here'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Time stats */}
            <div className="flex gap-3 flex-shrink-0">
              <div className="glass p-4 rounded-xl text-center min-w-[100px] glow-border-fuchsia">
                <span className="block text-3xl font-black text-brand-fuchsia text-glow-fuchsia font-mono">
                  {daysTogether}
                </span>
                <span className="text-[9px] uppercase text-slate-400 tracking-widest mt-0.5 block">Days Bound</span>
                <Star className="w-3 h-3 text-brand-fuchsia/50 mx-auto mt-1" />
              </div>
              {anniversaryCountdown !== null && (
                <div className="glass p-4 rounded-xl text-center min-w-[100px] glow-border-cyan">
                  <span className="block text-3xl font-black text-brand-cyan text-glow-cyan font-mono">
                    {anniversaryCountdown}
                  </span>
                  <span className="text-[9px] uppercase text-slate-400 tracking-widest mt-0.5 block">Days to Anniv.</span>
                  <Sparkles className="w-3 h-3 text-brand-cyan/50 mx-auto mt-1" />
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* ─── MOOD + PARTNER MOOD + SLOT MACHINE ───────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* My Mood Ring */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                <Smile className="w-4 h-4 text-brand-fuchsia icon-glow-fuchsia" />
                My Mood Ring
              </h2>
              <div className="text-[10px] bg-brand-violet/10 text-brand-violet px-2.5 py-1 rounded-full border border-brand-violet/20 font-mono truncate max-w-[100px]">
                {profile.mood || 'No mood'}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {MOOD_OPTIONS.map((mood) => {
                const isSelected = profile.mood?.includes(mood.label);
                const isRippling = moodRipple === mood.label;
                return (
                  <button
                    key={mood.label}
                    onClick={() => handleMoodToggle(mood)}
                    className={`mood-btn text-2xl p-2.5 rounded-xl cursor-pointer flex justify-center items-center relative overflow-hidden ${
                      isSelected
                        ? `bg-gradient-to-tr ${mood.color} shadow-lg`
                        : 'bg-white/5 border border-white/5 hover:bg-white/10'
                    }`}
                    style={isSelected ? { boxShadow: `0 0 16px ${mood.glow}` } : {}}
                    title={mood.label}
                  >
                    {mood.emoji}
                    {isRippling && (
                      <span className="absolute inset-0 rounded-xl animate-ripple"
                        style={{ background: mood.glow, pointerEvents: 'none' }} />
                    )}
                    {isSelected && (
                      <motion.div
                        layoutId={`mood-active-${mood.label}`}
                        className="absolute inset-0 border-2 border-white/30 rounded-xl"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Partner Mood */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass p-5 rounded-2xl border border-white/5 flex flex-col"
          >
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
              <Smile className="w-4 h-4 text-brand-cyan icon-glow-cyan" />
              {partnerProfile?.username || 'Partner'}&apos;s Mood
            </h2>
            {partnerProfile ? (
              <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-3">
                <div className="relative">
                  <div className="flex flex-wrap gap-2 justify-center text-4xl animate-float-gentle max-w-[200px]">
                    {partnerProfile.mood_emoji
                      ? partnerProfile.mood_emoji.split(', ').map((emoji, i) => (
                        <span key={i} className="drop-shadow-lg">{emoji}</span>
                      ))
                      : <span>🪐</span>
                    }
                  </div>
                  {/* Glow behind emoji */}
                  <div className="absolute inset-0 bg-brand-cyan/10 rounded-full blur-xl -z-10" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-bold text-slate-200">
                    {partnerProfile.username} is feeling
                  </span>
                  <span className="text-xs text-brand-cyan tracking-wider font-semibold font-mono">
                    {partnerProfile.mood || 'Celestial Ambient'}
                  </span>
                </div>
                {partnerProfile.last_active_at && (
                  <span className="text-[9px] text-slate-600">
                    Last seen {new Date(partnerProfile.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500 text-center">
                <div>
                  <div className="text-3xl mb-2">🌑</div>
                  Waiting for partner link...
                </div>
              </div>
            )}
          </motion.div>

          {/* Date Slot Machine */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass p-5 rounded-2xl border border-white/5 flex flex-col"
          >
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-brand-gold icon-glow-gold" />
              Date Night Spinner
            </h2>

            <div className="slot-window flex-1 p-4 min-h-[90px] flex flex-col justify-center items-center relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slotIndex}
                  initial={{ y: slotSpinning ? 30 : 0, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: slotSpinning ? -30 : 0, opacity: 0 }}
                  transition={{ duration: 0.08 }}
                  className="text-center"
                >
                  <span className="text-base font-bold block text-white">
                    {DATE_IDEAS[slotIndex].text}
                  </span>
                </motion.div>
              </AnimatePresence>
              {selectedIdea && !slotSpinning && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed"
                >
                  {selectedIdea.desc}
                </motion.p>
              )}
            </div>

            <button
              onClick={spinSlotMachine}
              disabled={slotSpinning}
              className="mt-3 w-full py-2.5 bg-gradient-to-r from-brand-gold to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:opacity-90 transition duration-300 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${slotSpinning ? 'animate-spin' : ''}`} />
              {slotSpinning ? 'Spinning...' : 'Spin for Date Activity'}
            </button>
          </motion.div>
        </section>

        {/* ─── STAT CARDS ─────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard href="/galaxy" icon={Compass} count={memories.length} label="Memory Stars"
            color="#7c3aed" delay={0.1} />
          <StatCard href="/canvas" icon={Edit3} count={drawings.length} label="Drawings Pinned"
            color="#d946ef" delay={0.15} />
          <StatCard href="/journal" icon={Film} count={movies.length} label="Movies Logged"
            color="#06b6d4" delay={0.2} />
          <StatCard icon={Trophy} count={achievements.length} label="Achievements"
            color="#f59e0b" delay={0.25} />
        </section>

        {/* ─── BOTTOM ROW: FRIDGE + NOTIFICATIONS ─────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Refrigerator Pinned drawing */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass p-5 rounded-2xl border border-white/5 flex flex-col"
          >
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-fuchsia icon-glow-fuchsia" />
                Refrigerator Door
              </h2>
              <Link href="/canvas" className="text-[10px] text-brand-fuchsia hover:underline flex items-center gap-1">
                <Zap className="w-3 h-3" /> Go Draw
              </Link>
            </div>

            <div className="flex-1 bg-slate-900/50 rounded-xl min-h-[170px] flex items-center justify-center border border-white/5 relative overflow-hidden">
              {/* Fridge texture lines */}
              <div className="absolute inset-0 opacity-[0.02]"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 20px)' }} />
              {pinnedDrawing ? (
                <motion.div
                  initial={{ rotate: -3, scale: 0.95 }}
                  animate={{ rotate: -3, scale: 1 }}
                  whileHover={{ rotate: 0, scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="fridge-pin relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pinnedDrawing.thumbnail_url || ''}
                    alt="Pinned Doodle"
                    className="max-h-[130px] max-w-[190px] object-contain"
                  />
                  <div className="text-[9px] text-slate-500 font-mono mt-1 text-center">
                    {pinnedDrawing.name || 'Our Doodle'}
                  </div>
                  {/* Magnet pin */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/50" />
                </motion.div>
              ) : (
                <div className="text-center text-xs text-slate-500 px-6">
                  <div className="text-3xl mb-2">🖼️</div>
                  <p>No doodles pinned yet.</p>
                  <p className="text-[10px] mt-1 text-slate-600">Draw something on Live Canvas and pin it here!</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Notifications feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="glass p-5 rounded-2xl border border-white/5 flex flex-col"
          >
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-cyan icon-glow-cyan" />
                Constellation Signals
                {notifications.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-brand-fuchsia text-white text-[9px] flex items-center justify-center font-bold animate-pulse">
                    {notifications.length}
                  </span>
                )}
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

            <div className="flex-1 bg-slate-900/50 rounded-xl p-3 min-h-[170px] max-h-[200px] overflow-y-auto space-y-2 border border-white/5">
              {notifications.length > 0 ? (
                notifications.map((notif, idx) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-2.5 bg-white/5 rounded-lg border border-white/5 text-xs text-slate-300 flex items-start gap-2"
                  >
                    <Star className="w-3 h-3 text-brand-gold shrink-0 mt-0.5" />
                    {notif.message}
                  </motion.div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-500 gap-2">
                  <BookOpen className="w-6 h-6 text-slate-700" />
                  <span>No celestial signals from your partner.</span>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* ─── ACHIEVEMENTS PEEK ───────────────────────────────────── */}
        {achievements.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass p-5 rounded-2xl border border-white/5"
          >
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-brand-gold icon-glow-gold" />
              Our Achievements
            </h2>
            <div className="flex flex-wrap gap-3">
              {achievements.slice(0, 6).map((ach) => (
                <div key={ach.id}
                  className="flex items-center gap-2 glass px-3 py-2 rounded-xl border border-brand-gold/10 hover:border-brand-gold/30 transition">
                  <Trophy className="w-3.5 h-3.5 text-brand-gold" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{ach.name}</div>
                    <div className="text-[9px] text-slate-500">{ach.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

      </main>

      <Navbar />
    </div>
  );
}
