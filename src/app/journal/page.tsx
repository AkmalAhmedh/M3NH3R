'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, Square, Play, Pause, X, Plus, Calendar, 
  MapPin, Lock, Unlock, Star 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import Navbar from '@/components/ui/Navbar';
import { 
  JournalEntry, VoiceCapsule, Movie, Game, LocationLog, 
  LoveLetter, TimeCapsule 
} from '@/types';

const EMOJI_LIST = ['🥰', '😊', '😭', '😴', '✨', '🔥', '💖', '🍿', '🎮'];
const TABS = [
  { id: 'diary', label: '📖 Diary' },
  { id: 'voice', label: '🎙️ Voice' },
  { id: 'popcorn-games', label: '🍿 Popcorn & Games' },
  { id: 'pindrop', label: '📍 Pin Drop' },
  { id: 'vaults', label: '⏳ Sealed Vaults' },
];

export default function JournalPage() {
  const router = useRouter();
  const { user, profile, partnerProfile, loading } = useApp();

  const [activeTab, setActiveTab] = useState('diary');
  
  // Data States
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [voiceCapsules, setVoiceCapsules] = useState<VoiceCapsule[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [locations, setLocations] = useState<LocationLog[]>([]);
  const [loveLetters, setLoveLetters] = useState<LoveLetter[]>([]);
  const [timeCapsules, setTimeCapsules] = useState<TimeCapsule[]>([]);

  // Open Modals
  const [modalType, setModalType] = useState<string | null>(null);

  // Form States
  const [formLoading, setFormLoading] = useState(false);
  
  // 1. Diary Form
  const [jTitle, setJTitle] = useState('');
  const [jContent, setJContent] = useState('');
  const [jEmoji, setJEmoji] = useState('✨');
  const [jDate, setJDate] = useState(new Date().toISOString().split('T')[0]);

  // 2. Voice Capsule Form & Recorder
  const [vTitle, setVTitle] = useState('');
  const [vCategory, setVCategory] = useState<VoiceCapsule['category']>('custom');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 3. Movie Form
  const [mTitle, setMTitle] = useState('');
  const [mType, setMType] = useState('movie');
  const [mRating, setMRating] = useState(5);
  const [mReview, setMReview] = useState('');
  const [mPoster, setMPoster] = useState('');
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);

  // 4. Game Form
  const [gTitle, setGTitle] = useState('');
  const [gHours, setGHours] = useState('1');
  const [gScreenshot, setGScreenshot] = useState('');
  const [gNotes, setGNotes] = useState('');
  const [gDate, setGDate] = useState(new Date().toISOString().split('T')[0]);

  // 5. Pin Drop Form
  const [lName, setLName] = useState('');
  const [lType, setLType] = useState<'restaurant' | 'cafe' | 'meetup' | 'trip'>('cafe');
  const [lNote, setLNote] = useState('');
  const [lDate, setLDate] = useState(new Date().toISOString().split('T')[0]);

  // 6. Love Letter Form
  const [llContent, setLlContent] = useState('');
  const [llUnlockDate, setLlUnlockDate] = useState(new Date().toISOString().split('T')[0]);

  // 7. Time Capsule Form
  const [tcTitle, setTcTitle] = useState('');
  const [tcContent, setTcContent] = useState('');
  const [tcAssetUrl, setTcAssetUrl] = useState('');
  const [tcUnlockDate, setTcUnlockDate] = useState(new Date().toISOString().split('T')[0]);

  // Audio Playback controllers
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!profile?.couple_id) {
        router.push('/onboarding');
      }
    }
  }, [user, profile, loading, router]);

  const loadData = useCallback(async () => {
    if (!profile?.couple_id || !profile?.id) return;
    try {
      const jnls = await db.getJournals(profile.couple_id);
      setJournals(jnls);
      const vcs = await db.getVoiceCapsules(profile.couple_id);
      setVoiceCapsules(vcs);
      const movs = await db.getMovies(profile.couple_id);
      setMovies(movs);
      const gms = await db.getGames(profile.couple_id);
      setGames(gms);
      const locs = await db.getLocations(profile.couple_id);
      setLocations(locs);
      const letters = await db.getLoveLetters(profile.couple_id, profile.id);
      setLoveLetters(letters);
      const capsules = await db.getTimeCapsules(profile.couple_id, profile.id);
      setTimeCapsules(capsules);
    } catch (err) {
      console.error(err);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.couple_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [profile, loadData]);

  const togglePlayAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioElementsRef.current[id]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioElementsRef.current[playingAudioId]) {
        audioElementsRef.current[playingAudioId].pause();
      }
      if (!audioElementsRef.current[id]) {
        audioElementsRef.current[id] = new Audio(url);
        audioElementsRef.current[id].onended = () => setPlayingAudioId(null);
      }
      audioElementsRef.current[id].play().catch(() => {});
      setPlayingAudioId(id);
    }
  };

  // --- Submissions ---

  const handleCreateDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !profile?.id) return;
    setFormLoading(true);
    await db.addJournal(profile.couple_id, profile.id, jTitle, jContent, jEmoji, jDate);
    setJTitle('');
    setJContent('');
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id) return;
    setFormLoading(true);
    const poster = mPoster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600';
    await db.addMovie(profile.couple_id, mTitle, mType, mRating, mReview, poster, mDate);
    setMTitle('');
    setMReview('');
    setMPoster('');
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id) return;
    setFormLoading(true);
    const ss = gScreenshot || 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=600';
    await db.addGame(profile.couple_id, gTitle, parseFloat(gHours) || 0, ss, gNotes, gDate);
    setGTitle('');
    setGHours('1');
    setGScreenshot('');
    setGNotes('');
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id) return;
    setFormLoading(true);
    // Emulate location coordinate math offsets
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.0060 + (Math.random() - 0.5) * 0.1;
    await db.addLocation(profile.couple_id, lName, lType, lat, lng, lNote, lDate);
    setLName('');
    setLNote('');
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  const handleCreateLoveLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !profile?.id || !partnerProfile?.id) return;
    setFormLoading(true);
    await db.addLoveLetter(profile.couple_id, profile.id, partnerProfile.id, llContent, llUnlockDate);
    setLlContent('');
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  const handleCreateTimeCapsule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !profile?.id) return;
    setFormLoading(true);
    const assets = tcAssetUrl ? [tcAssetUrl] : [];
    await db.addTimeCapsule(profile.couple_id, profile.id, tcTitle, tcContent, assets, tcUnlockDate);
    setTcTitle('');
    setTcContent('');
    setTcAssetUrl('');
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  // --- Voice Capturing ---
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Audio recorder initialization failed:', err);
      // Mock capture fallback
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setRecordedUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3');
      }, 2500);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(false);
    }
  };

  const handleSaveVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !profile?.id || !recordedUrl) return;
    setFormLoading(true);
    await db.addVoiceCapsule(profile.couple_id, profile.id, vTitle, recordedUrl, vCategory);
    setVTitle('');
    setRecordedUrl(null);
    setModalType(null);
    await loadData();
    setFormLoading(false);
  };

  if (loading || !profile) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {/* Background visual detail */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-brand-violet/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-brand-cyan/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Main Header */}
      <header className="max-w-5xl mx-auto px-6 pt-10 z-10 relative">
        <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia bg-clip-text text-transparent">
          TIMELINES & ARCHIVES
        </h1>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
          Chronological logs, vaults, pin drops and co-op statistics
        </p>

        {/* Custom Glass Tab Bar */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white shadow-lg' 
                  : 'glass text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Active Tab Panel renderer */}
      <main className="max-w-5xl mx-auto px-6 mt-8 z-10 relative">
        
        {/* TAB 1: DIARY */}
        {activeTab === 'diary' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shared Diary Entries</h2>
              <button
                onClick={() => setModalType('diary')}
                className="flex items-center gap-1 text-xs bg-brand-cyan text-slate-950 px-3.5 py-1.5 rounded-xl font-bold hover:opacity-90 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Entry
              </button>
            </div>

            <div className="space-y-4">
              {journals.map((entry) => (
                <div key={entry.id} className="glass p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{entry.emoji}</span>
                      <h3 className="text-xs font-bold text-slate-200">{entry.title}</h3>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {entry.date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-light leading-relaxed whitespace-pre-line bg-slate-900/40 p-3.5 rounded-xl border border-white/5">
                    {entry.content}
                  </p>
                </div>
              ))}
              {journals.length === 0 && (
                <div className="glass p-12 text-center text-xs text-slate-500 rounded-2xl border border-white/5">
                  Diary is empty. Let&apos;s record your first memory!
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 2: VOICE */}
        {activeTab === 'voice' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Stored Voice Capsules</h2>
              <button
                onClick={() => setModalType('voice')}
                className="flex items-center gap-1 text-xs bg-brand-fuchsia text-white px-3.5 py-1.5 rounded-xl font-bold hover:opacity-90 transition cursor-pointer"
              >
                <Mic className="w-4 h-4 animate-pulse" /> Record Capsule
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voiceCapsules.map((capsule) => {
                const isPlaying = playingAudioId === capsule.id;
                return (
                  <div key={capsule.id} className="glass p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200">{capsule.title}</h3>
                      <span className="text-[8px] uppercase tracking-wider font-semibold font-mono text-brand-fuchsia bg-brand-fuchsia/10 px-2 py-0.5 rounded mt-1.5 inline-block">
                        {capsule.category.replace('_', ' ')}
                      </span>
                    </div>
                    <button
                      onClick={() => togglePlayAudio(capsule.id, capsule.file_path)}
                      className={`p-2 rounded-full cursor-pointer transition ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-brand-violet text-white'}`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>
                  </div>
                );
              })}
              {voiceCapsules.length === 0 && (
                <div className="col-span-2 glass p-12 text-center text-xs text-slate-500 rounded-2xl border border-white/5">
                  No voice capsules archived yet.
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: POPCORN & GAMES */}
        {activeTab === 'popcorn-games' && (
          <section className="space-y-8">
            {/* Popcorn Movies Tracker */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🎬 Popcorn Movie reviews</h3>
                <button
                  onClick={() => setModalType('movie')}
                  className="text-xs bg-slate-900 border border-white/10 text-slate-200 px-3 py-1 rounded-xl cursor-pointer hover:bg-slate-800"
                >
                  Log Movie
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {movies.map((movie) => (
                  <div key={movie.id} className="glass p-4 rounded-xl border border-white/5 flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={movie.poster_url || ''} alt={movie.title} className="w-16 h-24 object-cover rounded-lg border border-white/5 bg-slate-950" />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 truncate">{movie.title}</h4>
                        <span className="text-[8px] uppercase tracking-wider font-mono font-semibold text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                          {movie.type}
                        </span>
                        <div className="flex gap-0.5 text-brand-gold mt-1.5">
                          {Array.from({ length: movie.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-brand-gold" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 italic line-clamp-2 mt-1">&quot;{movie.review}&quot;</p>
                    </div>
                  </div>
                ))}
                {movies.length === 0 && (
                  <div className="col-span-2 glass p-10 text-center text-xs text-slate-500 rounded-xl">No movies logged yet.</div>
                )}
              </div>
            </div>

            {/* Player 1 & 2 Games Tracker */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">🎮 Player 1 & Player 2 Games logs</h3>
                <button
                  onClick={() => setModalType('game')}
                  className="text-xs bg-slate-900 border border-white/10 text-slate-200 px-3 py-1 rounded-xl cursor-pointer hover:bg-slate-800"
                >
                  Log Game
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {games.map((game) => (
                  <div key={game.id} className="glass p-4 rounded-xl border border-white/5 flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={game.screenshot_url || ''} alt={game.title} className="w-20 h-20 object-cover rounded-lg border border-white/5 bg-slate-950" />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 truncate">{game.title}</h4>
                        <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                          Played hours: <strong className="text-brand-violet">{game.hours_played}h</strong>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1 line-clamp-2">Note: {game.notes}</p>
                    </div>
                  </div>
                ))}
                {games.length === 0 && (
                  <div className="col-span-2 glass p-10 text-center text-xs text-slate-500 rounded-xl">No gaming milestones logged yet.</div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: PIN DROP */}
        {activeTab === 'pindrop' && (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">📍 Pin Drop Locations Map</h2>
              <button
                onClick={() => setModalType('pindrop')}
                className="flex items-center gap-1 text-xs bg-brand-cyan text-slate-950 px-3.5 py-1.5 rounded-xl font-bold hover:opacity-90 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Drop Location Pin
              </button>
            </div>

            {/* Mock Spatial map display coordinates */}
            <div className="glass rounded-2xl border border-white/5 p-6 bg-slate-950 relative min-h-[300px] flex flex-col justify-between overflow-hidden shadow-inner shadow-black/85">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              
              <div className="relative flex-1">
                {/* Stylized pin elements floating in coordinate nodes */}
                {locations.map((loc, idx) => (
                  <div
                    key={loc.id}
                    className="absolute group"
                    style={{
                      left: `${20 + (idx * 17) % 60}%`,
                      top: `${20 + (idx * 23) % 60}%`
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-cyan/20 border border-brand-cyan flex items-center justify-center text-brand-cyan hover:scale-125 transition cursor-pointer animate-float">
                      <MapPin className="w-4 h-4 fill-brand-cyan/30" />
                    </div>
                    
                    {/* Hover labels */}
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 p-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 w-44 shadow-2xl">
                      <span className="block text-[10px] font-bold text-slate-200">{loc.name}</span>
                      <span className="text-[8px] uppercase tracking-wider font-semibold text-brand-cyan block mt-0.5">{loc.type}</span>
                      {loc.note && <span className="text-[9px] text-slate-400 block mt-1">&quot;{loc.note}&quot;</span>}
                    </div>
                  </div>
                ))}

                {locations.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-slate-500">
                    No coordinates mapped yet. Drop a pin!
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-center pt-4 border-t border-white/5 relative z-10">
                Hover pins to reveal logged cafes, restaurants, and trips.
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: VAULTS */}
        {activeTab === 'vaults' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Love Letters Sub-Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-slate-300">📬 Love Letter Vault</span>
                <button
                  onClick={() => setModalType('love-letter')}
                  className="text-[10px] bg-brand-violet/20 border border-brand-violet/30 hover:bg-brand-violet/30 text-brand-violet px-2.5 py-1 rounded-lg cursor-pointer transition font-bold"
                >
                  Seal Letter
                </button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {loveLetters.map((letter) => {
                  const today = new Date().toISOString().split('T')[0];
                  const isLocked = letter.unlock_date > today && letter.created_by !== profile.id;
                  
                  return (
                    <div key={letter.id} className="glass p-4 rounded-xl border border-white/5 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5 text-slate-400">
                        {isLocked ? <Lock className="w-4 h-4 text-brand-fuchsia" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] uppercase tracking-wider font-semibold font-mono text-slate-500">
                            {letter.created_by === profile.id ? 'Sent Letter' : 'Received Letter'}
                          </span>
                          <span className="text-[9px] text-slate-500">Unlocks: {letter.unlock_date}</span>
                        </div>
                        {isLocked ? (
                          <p className="text-[10px] text-slate-400 italic mt-1.5">This letter is sealed under cosmic date locks.</p>
                        ) : (
                          <p className="text-xs text-slate-200 whitespace-pre-line mt-1.5 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                            {letter.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {loveLetters.length === 0 && (
                  <div className="text-xs text-slate-500 py-6 text-center">No sealed love letters found.</div>
                )}
              </div>
            </div>

            {/* Time Capsule Sub-Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-slate-300">⏳ Time Capsules</span>
                <button
                  onClick={() => setModalType('time-capsule')}
                  className="text-[10px] bg-brand-fuchsia/20 border border-brand-fuchsia/30 hover:bg-brand-fuchsia/30 text-brand-fuchsia px-2.5 py-1 rounded-lg cursor-pointer transition font-bold"
                >
                  Lock Capsule
                </button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {timeCapsules.map((capsule) => {
                  const today = new Date().toISOString().split('T')[0];
                  const isLocked = capsule.unlock_date > today && capsule.created_by !== profile.id;
                  
                  return (
                    <div key={capsule.id} className="glass p-4 rounded-xl border border-white/5 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5 text-slate-400">
                        {isLocked ? <Lock className="w-4 h-4 text-brand-cyan" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{capsule.title}</h4>
                          <span className="text-[9px] text-slate-500 font-mono">Unlock: {capsule.unlock_date}</span>
                        </div>
                        {isLocked ? (
                          <div className="mt-2 space-y-1">
                            <span className="text-[9px] text-brand-cyan font-semibold tracking-wider uppercase block">Locked Countdown</span>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="w-1/3 h-full bg-brand-cyan animate-pulse" />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1.5 space-y-2">
                            <p className="text-xs text-slate-300 leading-relaxed font-light">{capsule.content}</p>
                            {capsule.assets_paths && capsule.assets_paths.length > 0 && (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={capsule.assets_paths[0]} alt="Capsule Asset" className="rounded max-h-24 object-cover w-full" />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeCapsules.length === 0 && (
                  <div className="text-xs text-slate-500 py-6 text-center">No time capsules locked.</div>
                )}
              </div>
            </div>

          </section>
        )}

      </main>

      {/* RENDER ALL MODAL FORMS DYNAMICALLY */}
      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md p-6 glass-intense rounded-2xl border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setModalType(null)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* DIARY ENTRY FORM */}
              {modalType === 'diary' && (
                <form onSubmit={handleCreateDiary} className="space-y-4">
                  <h2 className="text-sm font-bold bg-gradient-to-r from-brand-cyan to-brand-violet bg-clip-text text-transparent">Log Shared Diary</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Title</label>
                    <input type="text" required value={jTitle} onChange={(e) => setJTitle(e.target.value)} placeholder="Title" className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Date</label>
                      <input type="date" required value={jDate} onChange={(e) => setJDate(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Mood Emoji</label>
                      <select value={jEmoji} onChange={(e) => setJEmoji(e.target.value)} className="w-full py-2 px-3 glass-input text-xs bg-slate-900">
                        {EMOJI_LIST.map(em => <option key={em} value={em}>{em}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Diary text</label>
                    <textarea required value={jContent} onChange={(e) => setJContent(e.target.value)} rows={4} className="w-full py-2 px-3 glass-input text-xs resize-none" />
                  </div>
                  <button type="submit" disabled={formLoading} className="w-full py-2.5 bg-brand-cyan text-slate-950 font-bold rounded-lg text-xs cursor-pointer">
                    {formLoading ? 'Logging...' : 'Save Diary Entry'}
                  </button>
                </form>
              )}

              {/* RECORD VOICE CAPSULE */}
              {modalType === 'voice' && (
                <form onSubmit={handleSaveVoice} className="space-y-4">
                  <h2 className="text-sm font-bold bg-gradient-to-r from-brand-violet to-brand-fuchsia bg-clip-text text-transparent">Record Voice Capsule</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Memo Title</label>
                    <input type="text" required value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder="e.g. Secret message" className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Category</label>
                    <select value={vCategory} onChange={(e) => setVCategory(e.target.value as VoiceCapsule['category'])} className="w-full py-2 px-3 glass-input text-xs bg-slate-900">
                      <option value="good_morning">Good Morning</option>
                      <option value="good_night">Good Night</option>
                      <option value="anniversary">Anniversary</option>
                      <option value="custom">Custom Memo</option>
                    </select>
                  </div>
                  <div className="bg-slate-950/80 p-4 rounded-lg flex flex-col items-center justify-center space-y-3 border border-white/5">
                    {isRecording ? (
                      <button type="button" onClick={stopVoiceRecording} className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center text-white"><Square className="w-4 h-4 fill-white" /></button>
                    ) : (
                      <button type="button" onClick={startVoiceRecording} className="w-12 h-12 bg-brand-violet rounded-full flex items-center justify-center text-white"><Mic className="w-5 h-5" /></button>
                    )}
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">{isRecording ? 'Recording...' : 'Click to record'}</span>
                    {recordedUrl && <div className="text-[9px] text-emerald-400">Audio memo captured!</div>}
                  </div>
                  <button type="submit" disabled={formLoading || !recordedUrl} className="w-full py-2.5 bg-brand-fuchsia text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50">
                    Lock Voice capsule
                  </button>
                </form>
              )}

              {/* MOVIE REVIEW FORM */}
              {modalType === 'movie' && (
                <form onSubmit={handleCreateMovie} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-200">🎬 Log Watched Movie</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Movie Title</label>
                    <input type="text" required value={mTitle} onChange={(e) => setMTitle(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Type</label>
                      <select value={mType} onChange={(e) => setMType(e.target.value)} className="w-full py-2 px-3 glass-input text-xs bg-slate-900">
                        <option value="movie">Movie</option>
                        <option value="series">TV Series</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Score Rating</label>
                      <select value={mRating} onChange={(e) => setMRating(parseInt(e.target.value))} className="w-full py-2 px-3 glass-input text-xs bg-slate-900">
                        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Poster Image URL (Optional)</label>
                    <input type="text" value={mPoster} onChange={(e) => setMPoster(e.target.value)} placeholder="https://example.com/poster.jpg" className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Watched Date</label>
                    <input type="date" required value={mDate} onChange={(e) => setMDate(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Brief Review</label>
                    <textarea value={mReview} onChange={(e) => setMReview(e.target.value)} className="w-full py-2 px-3 glass-input text-xs resize-none" rows={3} />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-brand-cyan text-slate-950 font-bold rounded-lg text-xs cursor-pointer">Log Watched Movie</button>
                </form>
              )}

              {/* GAME LOG FORM */}
              {modalType === 'game' && (
                <form onSubmit={handleCreateGame} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-200">🎮 Log Co-op Game</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Game Title</label>
                    <input type="text" required value={gTitle} onChange={(e) => setGTitle(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Hours Played</label>
                      <input type="number" required value={gHours} onChange={(e) => setGHours(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Played Date</label>
                      <input type="date" required value={gDate} onChange={(e) => setGDate(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Screenshot URL (Optional)</label>
                    <input type="text" value={gScreenshot} onChange={(e) => setGScreenshot(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Gaming Session Notes</label>
                    <textarea value={gNotes} onChange={(e) => setGNotes(e.target.value)} className="w-full py-2 px-3 glass-input text-xs resize-none" rows={3} />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-brand-violet text-white font-bold rounded-lg text-xs cursor-pointer">Log Game Milestone</button>
                </form>
              )}

              {/* LOCATION PIN DROPMAP FORM */}
              {modalType === 'pindrop' && (
                <form onSubmit={handleCreateLocation} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-200">📍 Drop Location Pin</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Location Name</label>
                    <input type="text" required value={lName} onChange={(e) => setLName(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Pin Type</label>
                      <select value={lType} onChange={(e) => setLType(e.target.value as LocationLog['type'])} className="w-full py-2 px-3 glass-input text-xs bg-slate-900">
                        <option value="cafe">☕ Cafe</option>
                        <option value="restaurant">🍕 Restaurant</option>
                        <option value="meetup">💖 Meetup</option>
                        <option value="trip">✈️ Trip</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Visited Date</label>
                      <input type="date" required value={lDate} onChange={(e) => setLDate(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Annotation Note</label>
                    <textarea value={lNote} onChange={(e) => setLNote(e.target.value)} className="w-full py-2 px-3 glass-input text-xs resize-none" rows={3} />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-brand-cyan text-slate-950 font-bold rounded-lg text-xs cursor-pointer">Map Location Pin</button>
                </form>
              )}

              {/* SEAL LOVE LETTER FORM */}
              {modalType === 'love-letter' && (
                <form onSubmit={handleCreateLoveLetter} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-200">📬 Seal Love Letter</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Sealed Unlock Date</label>
                    <input type="date" required value={llUnlockDate} onChange={(e) => setLlUnlockDate(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Love Letter Content</label>
                    <textarea required value={llContent} onChange={(e) => setLlContent(e.target.value)} className="w-full py-2 px-3 glass-input text-xs resize-none" rows={5} />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-brand-violet text-white font-bold rounded-lg text-xs cursor-pointer">Seal Letter in Vault</button>
                </form>
              )}

              {/* TIME CAPSULE FORM */}
              {modalType === 'time-capsule' && (
                <form onSubmit={handleCreateTimeCapsule} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-200">⏳ Lock Time Capsule</h2>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Capsule Title</label>
                    <input type="text" required value={tcTitle} onChange={(e) => setTcTitle(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Capsule Photo URL (Optional)</label>
                      <input type="text" value={tcAssetUrl} onChange={(e) => setTcAssetUrl(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Unlock Date</label>
                      <input type="date" required value={tcUnlockDate} onChange={(e) => setTcUnlockDate(e.target.value)} className="w-full py-2 px-3 glass-input text-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Capsule Message Notes</label>
                    <textarea required value={tcContent} onChange={(e) => setTcContent(e.target.value)} className="w-full py-2 px-3 glass-input text-xs resize-none" rows={4} />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-brand-fuchsia text-white font-bold rounded-lg text-xs cursor-pointer">Lock Time Capsule</button>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}
