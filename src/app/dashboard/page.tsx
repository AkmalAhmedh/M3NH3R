'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Smile, Compass, Edit3,
  Sparkles, Bell, Trophy, BookOpen,
  Film, Zap, Star, RefreshCw, User,
  Activity, Music, Send, Wifi, WifiOff,
  ChevronRight, Gift
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Navbar from '@/components/ui/Navbar';
import { Memory, Drawing, Movie, AppNotification, Achievement } from '@/types';

// ── Mood Options ──────────────────────────────────────────────
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
  { text: '🎮 Co-op Gaming', desc: 'Beat a boss together or race in Mario Kart.' },
  { text: '☕ Cozy Cafe Date', desc: 'Grab lattes and talk for hours about everything.' },
  { text: '🍕 Pizza & Doodles', desc: 'Order a pie and draw together on canvas.' },
  { text: '🌊 Sunset Beach Walk', desc: 'Walk along the shore and watch the horizon.' },
  { text: '🍳 Cook Together', desc: 'Try a brand new recipe as a team.' },
  { text: '⭐ Star Gazing', desc: 'Lie down under the night sky and dream.' },
  { text: '🎨 Art Night', desc: 'Paint or sketch portraits of each other.' },
  { text: '🧘 Yoga & Chill', desc: 'Flow through a relaxing session together.' },
  { text: '📚 Read Together', desc: 'Pick a book and take turns reading aloud.' },
  { text: '🎤 Karaoke Night', desc: 'Sing your hearts out, no judgement!' },
  { text: '🚗 Mystery Drive', desc: 'Drive with no destination, see where you end up.' },
];

const VIBE_OPTIONS = [
  { label: 'Lo-fi Chill', emoji: '🎵', color: 'text-sky-400', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: 'Romantic', emoji: '🎻', color: 'text-rose-400', url: 'https://www.youtube.com/watch?v=OFhDQVejMlI' },
  { label: 'Study Mode', emoji: '📖', color: 'text-amber-400', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' },
  { label: 'Party Vibes', emoji: '🎉', color: 'text-fuchsia-400', url: 'https://www.youtube.com/watch?v=b_IDdQkdXDM' },
];

// ── Stat Card ─────────────────────────────────────────────────
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

// ── Name Fix Prompt ───────────────────────────────────────────
function isEmailPrefix(username: string, email: string) {
  return username === email.split('@')[0] || !username || username.length < 2;
}

// ── Main Component ────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, partnerProfile, couple, loading, updateMood, refreshState } = useApp();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Slot machine
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotIndex, setSlotIndex] = useState(0);
  const [selectedIdea, setSelectedIdea] = useState<typeof DATE_IDEAS[0] | null>(null);
  const [moodRipple, setMoodRipple] = useState<string | null>(null);

  // Name fix banner
  const [showNameBanner, setShowNameBanner] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Hug feature
  const [hugSent, setHugSent] = useState(false);
  const [hugReceived, setHugReceived] = useState(false);

  // Vibe
  const [activeVibe, setActiveVibe] = useState<string | null>(null);

  // Partner online
  const [partnerOnline, setPartnerOnline] = useState(false);

  // Health score
  const [healthScore, setHealthScore] = useState(0);

  // Redirect guard
  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login');
      else if (!profile?.couple_id) router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  // Show name fix banner if username is email prefix
  useEffect(() => {
    if (profile && user) {
      if (isEmailPrefix(profile.username, profile.email)) {
        setShowNameBanner(true);
      }
    }
  }, [profile, user]);

  // Partner online presence via Supabase Realtime
  useEffect(() => {
    if (!profile?.couple_id || !partnerProfile?.id) return;
    const channel = supabase.channel(`presence-${profile.couple_id}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partnerPresent = Object.values(state).some((arr) =>
          (arr as unknown as {userId: string}[]).some(p => p.userId === partnerProfile.id)
        );
        setPartnerOnline(partnerPresent);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: profile.id });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [profile?.couple_id, profile?.id, partnerProfile?.id]);

  // Listen for hug notifications
  useEffect(() => {
    if (!profile?.couple_id || !profile?.id) return;
    const channel = supabase.channel(`hugs-${profile.id}`)
      .on('broadcast', { event: 'hug' }, ({ payload }) => {
        if (payload.to === profile.id) {
          setHugReceived(true);
          setTimeout(() => setHugReceived(false), 4000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.couple_id, profile?.id]);

  // Mood toggle
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

      // Compute health score
      const score = Math.min(100, 
        20 + // base
        Math.min(mems.length * 5, 25) +
        Math.min(movs.length * 3, 15) +
        Math.min(drws.length * 4, 20) +
        Math.min(achs.length * 5, 20)
      );
      setHealthScore(score);
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
    const days = Math.ceil((nextAnn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
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

  const handleSendHug = async () => {
    if (!profile?.couple_id || !partnerProfile?.id) return;
    // Broadcast via realtime
    await supabase.channel(`hugs-${partnerProfile.id}`).send({
      type: 'broadcast', event: 'hug',
      payload: { from: profile.username, to: partnerProfile.id }
    });
    // Also send a notification
    await supabase.from('notifications').insert({
      couple_id: profile.couple_id,
      recipient_id: partnerProfile.id,
      sender_id: profile.id,
      type: 'hug',
      message: `${profile.username} sent you a warm hug! 🤗💕`,
    });
    setHugSent(true);
    setTimeout(() => setHugSent(false), 3000);
  };

  const handleSaveName = async () => {
    if (!newName.trim() || !profile?.id) return;
    setNameSaving(true);
    try {
      await db.updateProfileName(profile.id, newName.trim());
      await refreshState();
      setNameSuccess(true);
      setTimeout(() => {
        setShowNameBanner(false);
        setNameSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setNameSaving(false);
    }
  };

  const daysTogether = getDaysTogether();
  const anniversaryCountdown = getAnniversaryCountdown();
  const pinnedDrawing = drawings.find(d => d.is_pinned);

  if (loading || !profile || !couple) return null;

  return (
    <div className="min-h-screen cinematic-bg text-slate-100 flex flex-col pb-32 relative">
      {/* Nebula orbs */}
      <div className="fixed top-0 right-1/4 w-[600px] h-[600px] bg-brand-violet/6 rounded-full filter blur-[120px] pointer-events-none animate-nebula" />
      <div className="fixed bottom-10 left-0 w-[500px] h-[500px] bg-brand-cyan/5 rounded-full filter blur-[100px] pointer-events-none animate-nebula-2" />
      <div className="fixed top-1/2 left-1/2 w-[400px] h-[400px] bg-brand-fuchsia/4 rounded-full filter blur-[100px] pointer-events-none animate-nebula-3" />

      <main className="max-w-5xl mx-auto w-full px-4 md:px-6 pt-8 space-y-6 relative z-10">

        {/* ── NAME FIX BANNER ─────────────────────────────────── */}
        <AnimatePresence>
          {showNameBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-aurora p-4 rounded-2xl border border-brand-violet/30"
            >
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 bg-brand-violet/20 rounded-full flex items-center justify-center border border-brand-violet/40">
                    <User className="w-4 h-4 text-brand-violet" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Set your display name</p>
                    <p className="text-[10px] text-slate-400">Your name is showing as an email prefix. Add your real name so your partner sees you properly! 💕</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    placeholder="Your name (e.g. Akmal)"
                    className="glass-input px-3 py-2 text-sm flex-1 md:w-44"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameSaving || !newName.trim()}
                    className="px-4 py-2 bg-brand-violet hover:opacity-90 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
                  >
                    {nameSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : nameSuccess ? '✓' : 'Save'}
                  </button>
                  <button onClick={() => setShowNameBanner(false)} className="text-slate-500 hover:text-slate-300 text-lg leading-none cursor-pointer px-1">×</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HUG RECEIVED ANIMATION ──────────────────────────── */}
        <AnimatePresence>
          {hugReceived && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none text-center"
            >
              <div className="text-8xl mb-4 animate-bounce">🤗</div>
              <p className="text-2xl font-black text-brand-fuchsia text-glow-fuchsia">
                {partnerProfile?.username || 'Your partner'} hugged you!
              </p>
              <div className="text-4xl mt-3 flex gap-2 justify-center">
                {['💕', '💖', '💗', '💓'].map((h, i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -30, 0], opacity: [1, 1, 0] }}
                    transition={{ delay: i * 0.1, duration: 1.5, repeat: 2 }}
                  >
                    {h}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO HEADER ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative glass-aurora overflow-hidden"
        >
          <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Orbit heart */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <div className="absolute inset-0 border border-brand-violet/20 rounded-full animate-orbit" />
                <div className="absolute inset-1 border border-brand-cyan/15 rounded-full animate-orbit-reverse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-tr from-brand-violet to-brand-fuchsia rounded-full flex items-center justify-center shadow-lg shadow-brand-violet/30 animate-heartbeat">
                    <Heart className="w-6 h-6 fill-white text-white" />
                  </div>
                </div>
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
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
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
                  {/* Partner online indicator */}
                  <span className={`flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${partnerOnline ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-500 border-slate-700/50 bg-slate-800/30'}`}>
                    {partnerOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                    {partnerOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Stats + Send Hug */}
            <div className="flex gap-3 flex-shrink-0 flex-wrap justify-center">
              <div className="glass p-4 rounded-xl text-center min-w-[90px] glow-border-fuchsia">
                <span className="block text-3xl font-black text-brand-fuchsia text-glow-fuchsia font-mono">{daysTogether}</span>
                <span className="text-[9px] uppercase text-slate-400 tracking-widest mt-0.5 block">Days Together</span>
              </div>
              {anniversaryCountdown !== null && (
                <div className="glass p-4 rounded-xl text-center min-w-[90px] glow-border-cyan">
                  <span className="block text-3xl font-black text-brand-cyan text-glow-cyan font-mono">{anniversaryCountdown}</span>
                  <span className="text-[9px] uppercase text-slate-400 tracking-widest mt-0.5 block">Days to Anniv.</span>
                </div>
              )}
              {/* Send Hug */}
              <motion.button
                onClick={handleSendHug}
                whileTap={{ scale: 0.9 }}
                className={`glass p-4 rounded-xl text-center min-w-[90px] border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${hugSent ? 'border-brand-fuchsia/40 bg-brand-fuchsia/10' : 'border-white/10 hover:border-brand-fuchsia/30'}`}
              >
                <span className="text-3xl">{hugSent ? '💌' : '🤗'}</span>
                <span className="text-[9px] uppercase text-slate-400 tracking-widest">{hugSent ? 'Sent!' : 'Send Hug'}</span>
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* ── MOOD + PARTNER + SLOT MACHINE ─────────────────── */}
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
              <div className="text-[10px] bg-brand-violet/10 text-brand-violet px-2.5 py-1 rounded-full border border-brand-violet/20 font-mono truncate max-w-[110px]">
                {profile.mood || 'No mood set'}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {MOOD_OPTIONS.map((mood) => {
                const isSelected = profile.mood?.includes(mood.label);
                const isRippling = moodRipple === mood.label;
                return (
                  <button
                    key={mood.label}
                    onClick={() => handleMoodToggle(mood)}
                    className={`mood-btn text-2xl p-2.5 rounded-xl cursor-pointer flex justify-center items-center relative overflow-hidden ${
                      isSelected ? `bg-gradient-to-tr ${mood.color} shadow-lg` : 'bg-white/5 border border-white/5 hover:bg-white/10'
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
            <p className="text-[9px] text-slate-600 mt-3 text-center">Tap multiple moods to combine them</p>
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
              <span className={`ml-auto w-2 h-2 rounded-full ${partnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            </h2>
            {partnerProfile ? (
              <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-3">
                <div className="flex flex-wrap gap-2 justify-center text-4xl animate-float-gentle max-w-[200px]">
                  {partnerProfile.mood_emoji
                    ? partnerProfile.mood_emoji.split(', ').map((emoji, i) => (
                      <span key={i} className="drop-shadow-lg">{emoji}</span>
                    ))
                    : <span>🪐</span>
                  }
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
                  <span className="text-base font-bold block text-white">{DATE_IDEAS[slotIndex].text}</span>
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
              {slotSpinning ? 'Spinning...' : 'Spin for Date Idea'}
            </button>
          </motion.div>
        </section>

        {/* ── STAT CARDS ─────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard href="/galaxy" icon={Compass} count={memories.length} label="Memory Stars" color="#7c3aed" delay={0.1} />
          <StatCard href="/canvas" icon={Edit3} count={drawings.length} label="Artworks" color="#d946ef" delay={0.15} />
          <StatCard href="/journal" icon={Film} count={movies.length} label="Movies Logged" color="#06b6d4" delay={0.2} />
          <StatCard icon={Trophy} count={achievements.length} label="Achievements" color="#f59e0b" delay={0.25} />
        </section>

        {/* ── NEW FEATURE ROW: VIBE + HEALTH SCORE ──────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Vibe Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass p-5 rounded-2xl border border-white/5"
          >
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
              <Music className="w-4 h-4 text-brand-fuchsia icon-glow-fuchsia" />
              Tonight&apos;s Vibe
              <span className="text-[9px] text-slate-500 ml-1">Pick a mood playlist</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {VIBE_OPTIONS.map((v) => (
                <a
                  key={v.label}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setActiveVibe(v.label)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition cursor-pointer group
                    ${activeVibe === v.label
                      ? 'border-brand-violet/40 bg-brand-violet/10'
                      : 'border-white/5 bg-white/3 hover:bg-white/8 hover:border-white/15'
                    }`}
                >
                  <span className="text-2xl group-hover:animate-bounce">{v.emoji}</span>
                  <div>
                    <span className={`block text-xs font-semibold ${v.color}`}>{v.label}</span>
                    <span className="text-[8px] text-slate-500">Open on YouTube ↗</span>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Relationship Health Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass p-5 rounded-2xl border border-white/5"
          >
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" style={{ filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.8))' }} />
              Relationship Health
              <span className="text-[9px] text-slate-500 ml-1">Based on your activity</span>
            </h2>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={healthScore >= 80 ? '#34d399' : healthScore >= 50 ? '#f59e0b' : '#f43f5e'}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - healthScore / 100) }}
                    transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                    style={{ filter: `drop-shadow(0 0 6px ${healthScore >= 80 ? '#34d399' : healthScore >= 50 ? '#f59e0b' : '#f43f5e'})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center rotate-0">
                  <span className="text-xl font-black text-white">{healthScore}%</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs font-semibold text-slate-200">
                  {healthScore >= 80 ? '🌟 Thriving!' : healthScore >= 60 ? '💪 Growing Strong' : healthScore >= 40 ? '🌱 Building Together' : '💫 Just Getting Started'}
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Memories', val: Math.min(memories.length * 5, 25), max: 25 },
                    { label: 'Movies', val: Math.min(movies.length * 3, 15), max: 15 },
                    { label: 'Artworks', val: Math.min(drawings.length * 4, 20), max: 20 },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                        <span>{item.label}</span>
                        <span>{item.val}/{item.max}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-brand-violet to-brand-cyan rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.val / item.max) * 100}%` }}
                          transition={{ duration: 1, delay: 0.6 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── FRIDGE + NOTIFICATIONS ─────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Refrigerator Door */}
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
                  <img src={pinnedDrawing.thumbnail_url || ''} alt="Pinned Doodle" className="max-h-[130px] max-w-[190px] object-contain" />
                  <div className="text-[9px] text-slate-500 font-mono mt-1 text-center">{pinnedDrawing.name || 'Our Doodle'}</div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/50" />
                </motion.div>
              ) : (
                <div className="text-center text-xs text-slate-500 px-6">
                  <div className="text-3xl mb-2">🖼️</div>
                  <p>No doodles pinned yet.</p>
                  <p className="text-[10px] mt-1 text-slate-600">Draw something and pin it here!</p>
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
                Signals
                {notifications.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-brand-fuchsia text-white text-[9px] flex items-center justify-center font-bold animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </h2>
              {notifications.length > 0 && (
                <button onClick={handleMarkNotifications} className="text-[10px] text-brand-cyan hover:underline cursor-pointer">
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
                    <span className="text-base">{notif.type === 'hug' ? '🤗' : notif.type === 'doodle' ? '🎨' : '⭐'}</span>
                    {notif.message}
                  </motion.div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-500 gap-2">
                  <BookOpen className="w-6 h-6 text-slate-700" />
                  <span>No signals yet. Send your partner a hug! 🤗</span>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* ── QUICK LINKS ROW ────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass p-5 rounded-2xl border border-white/5"
        >
          <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-brand-gold icon-glow-gold" />
            Quick Launch
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/galaxy', emoji: '🌌', label: 'Memory Galaxy', color: 'text-brand-violet', desc: 'Star your memories' },
              { href: '/canvas', emoji: '✏️', label: 'Live Canvas', color: 'text-brand-fuchsia', desc: 'Draw together' },
              { href: '/journal', emoji: '📖', label: 'Diary & Tracker', color: 'text-brand-cyan', desc: 'Log movies & places' },
              { href: '/settings', emoji: '⚙️', label: 'Settings', color: 'text-slate-300', desc: 'Wants & anniversary' },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 p-3 bg-white/3 hover:bg-white/8 border border-white/5 hover:border-white/15 rounded-xl transition group cursor-pointer">
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="min-w-0">
                    <span className={`block text-xs font-semibold ${item.color}`}>{item.label}</span>
                    <span className="text-[9px] text-slate-500">{item.desc}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition ml-auto shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* ── ACHIEVEMENTS ───────────────────────────────────── */}
        {achievements.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass p-5 rounded-2xl border border-white/5"
          >
            <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-brand-gold icon-glow-gold" />
              Our Achievements
              <span className="text-[9px] text-slate-500 ml-1">{achievements.length} unlocked</span>
            </h2>
            <div className="flex flex-wrap gap-3">
              {achievements.slice(0, 8).map((ach) => (
                <div key={ach.id} className="flex items-center gap-2 glass px-3 py-2 rounded-xl border border-brand-gold/10 hover:border-brand-gold/30 transition">
                  <Gift className="w-3.5 h-3.5 text-brand-gold" />
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
