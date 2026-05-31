'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Settings, Heart, Calendar, ShieldAlert, AlertTriangle, EyeOff, Eye, 
  Trash, Plus, Lock, RefreshCw, Compass 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import Navbar from '@/components/ui/Navbar';
import { Want, BreakupRequest } from '@/types';

const CATEGORIES = [
  { value: 'cravings', label: '🍟 Cravings' },
  { value: 'future plans', label: '✈️ Future Plans' },
  { value: 'activities', label: '🎮 Activities' },
  { value: 'emotional needs', label: '🤗 Emotional Needs' },
  { value: 'wishlist', label: '🎁 Wishlist' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, couple, loading, refreshState, logOut } = useApp();

  const [wants, setWants] = useState<Want[]>([]);
  const [newWant, setNewWant] = useState('');
  const [wantCategory, setWantCategory] = useState('cravings');
  const [isSensitive, setIsSensitive] = useState(false);
  const [revealedWants, setRevealedWants] = useState<{ [key: string]: boolean }>({});
  const [wantsLoading, setWantsLoading] = useState(false);

  // Anniversary date editor
  const [annDate, setAnnDate] = useState(couple?.anniversary_date || '');
  const [annSuccess, setAnnSuccess] = useState(false);

  // Breakup consent states
  const [activeBreakup, setActiveBreakup] = useState<BreakupRequest | null>(null);
  const [breakupLoading, setBreakupLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!profile?.couple_id) {
        router.push('/onboarding');
      }
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    const loadSettingsData = async () => {
      if (!profile?.couple_id) return;
      try {
        const wantItems = await db.getWants(profile.couple_id);
        setWants(wantItems);
        const req = await db.getBreakupRequest(profile.couple_id);
        setActiveBreakup(req);
        if (couple?.anniversary_date) {
          setAnnDate(couple.anniversary_date);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (profile?.couple_id) {
      loadSettingsData();
    }
  }, [profile?.couple_id, couple?.anniversary_date]);

  const handleUpdateAnniversary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !annDate) return;
    try {
      await db.updateAnniversary(profile.couple_id, annDate);
      setAnnSuccess(true);
      setTimeout(() => setAnnSuccess(false), 3000);
      await refreshState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !profile?.id || !newWant) return;
    setWantsLoading(true);

    try {
      const added = await db.addWant(profile.couple_id, profile.id, newWant, wantCategory as Want['category'], isSensitive);
      setWants((prev) => [...prev, added]);
      setNewWant('');
      setIsSensitive(false);
    } catch (err) {
      console.error(err);
    } finally {
      setWantsLoading(false);
    }
  };

  const handleDeleteWant = async (wantId: string) => {
    try {
      await db.deleteWant(wantId);
      setWants((prev) => prev.filter((w) => w.id !== wantId));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleRevealWant = (wantId: string) => {
    setRevealedWants((prev) => ({ ...prev, [wantId]: !prev[wantId] }));
  };

  // --- Breakup Consent logic ---
  const handleInitiateBreakup = async () => {
    if (!profile?.couple_id || !profile?.id) return;
    if (!confirm('Are you absolutely sure you want to request ending this relationship? Both partners must consent to unlink.')) return;
    setBreakupLoading(true);
    try {
      const req = await db.initiateBreakup(profile.couple_id, profile.id);
      setActiveBreakup(req);
    } catch (err) {
      console.error(err);
    } finally {
      setBreakupLoading(false);
    }
  };

  const handleRespondBreakup = async (accept: boolean) => {
    if (!activeBreakup || !profile?.couple_id) return;
    setBreakupLoading(true);
    try {
      await db.respondToBreakup(activeBreakup.id, accept, profile.couple_id);
      if (accept) {
        // Redirect to onboarding/single state
        window.location.href = '/onboarding';
      } else {
        // Declined
        setActiveBreakup(null);
        alert('Breakup request declined. Your relationship remains active.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBreakupLoading(false);
    }
  };

  const myWants = wants.filter((w) => w.user_id === profile?.id);
  const partnerWants = wants.filter((w) => w.user_id !== profile?.id);

  if (loading || !profile || !couple) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="text-center space-y-4">
          <Compass className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
          <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">Opening Universe settings panel...</p>
          <button
            onClick={async () => {
              await logOut();
              router.push('/login');
            }}
            className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer block mx-auto font-mono"
          >
            Stuck? Go to Sign In Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {/* Background radial overlays */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-brand-violet/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-brand-fuchsia/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Main Header */}
      <header className="max-w-5xl mx-auto px-6 pt-10 flex justify-between items-center z-10 relative">
        <div>
          <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-brand-violet to-brand-fuchsia bg-clip-text text-transparent flex items-center gap-1.5">
            <Settings className="w-5 h-5" /> UNIVERSE CONTROL PANEL
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Configure preference spaces, dates, and consent states
          </p>
        </div>
      </header>

      {/* Breakup Consent notification banner */}
      {activeBreakup && (
        <div className="max-w-5xl mx-auto px-6 mt-6 z-10 relative">
          <div className="glass p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Mutual Consent Breakup Request Pending</span>
                <span className="text-[10px] text-slate-400">
                  {activeBreakup.initiator_id === profile.id 
                    ? 'Waiting for your partner to accept the request...' 
                    : 'Your partner has initiated a request to end this connection. Do you accept?'}
                </span>
              </div>
            </div>

            {activeBreakup.initiator_id !== profile.id && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleRespondBreakup(true)}
                  disabled={breakupLoading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleRespondBreakup(false)}
                  disabled={breakupLoading}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Settings Grid */}
      <main className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 z-10 relative">
        
        {/* Columns 1 & 2: His Wants / Her Wants Preference Spaces */}
        <section className="lg:col-span-2 space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
              <Heart className="w-4 h-4 text-brand-fuchsia" /> Preference Space (Wants)
            </h2>

            {/* Input Form */}
            <form onSubmit={handleAddWant} className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase text-slate-400 tracking-wider mb-1">Want Category</label>
                  <select
                    value={wantCategory}
                    onChange={(e) => setWantCategory(e.target.value)}
                    className="w-full py-2 px-3 glass-input text-[11px] bg-slate-900"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 uppercase tracking-wider mb-2">
                    <input
                      type="checkbox"
                      checked={isSensitive}
                      onChange={(e) => setIsSensitive(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-brand-violet accent-brand-violet"
                    />
                    <span>Blur Sensitive entry</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newWant}
                  onChange={(e) => setNewWant(e.target.value)}
                  placeholder="e.g. Cravings: Double cheese pizza tonight"
                  className="flex-1 py-2 px-3 glass-input text-xs"
                />
                <button
                  type="submit"
                  disabled={wantsLoading}
                  className="px-4 py-2 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-lg text-xs font-semibold hover:opacity-95 transition cursor-pointer flex justify-center items-center"
                >
                  {wantsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </form>

            {/* Wants Displays */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* My Wants */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1">
                  My Wants List
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {myWants.map((want) => (
                    <WantCard
                      key={want.id}
                      want={want}
                      isMine={true}
                      revealed={!!revealedWants[want.id]}
                      onReveal={toggleRevealWant}
                      onDelete={handleDeleteWant}
                    />
                  ))}
                  {myWants.length === 0 && (
                    <div className="text-[10px] text-slate-500 py-6 text-center">No wants logged yet.</div>
                  )}
                </div>
              </div>

              {/* Partner's Wants */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1">
                  Partner Wants List
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {partnerWants.map((want) => (
                    <WantCard
                      key={want.id}
                      want={want}
                      isMine={false}
                      revealed={!!revealedWants[want.id]}
                      onReveal={toggleRevealWant}
                      onDelete={handleDeleteWant}
                    />
                  ))}
                  {partnerWants.length === 0 && (
                    <div className="text-[10px] text-slate-500 py-6 text-center">No wants logged by partner yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Column 3: Relationship configurations */}
        <section className="space-y-6">
          {/* Anniversary Card */}
          <div className="glass p-5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-cyan" /> Anniversary Details
            </h2>

            <form onSubmit={handleUpdateAnniversary} className="space-y-3">
              <div>
                <label className="block text-[9px] uppercase text-slate-400 tracking-wider mb-1">Anniversary Date</label>
                <input
                  type="date"
                  required
                  value={annDate}
                  onChange={(e) => setAnnDate(e.target.value)}
                  className="w-full py-2 px-3 glass-input text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-brand-cyan hover:opacity-90 transition rounded-lg text-xs font-semibold text-slate-950 cursor-pointer flex justify-center items-center gap-1"
              >
                Save Anniversary Date
              </button>

              {annSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-[10px] text-emerald-400"
                >
                  Anniversary details synced!
                </motion.div>
              )}
            </form>
          </div>

          {/* Breakup Consent trigger card */}
          <div className="glass p-5 rounded-2xl border border-rose-950/20 bg-rose-950/5 space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Danger Zone
            </h2>
            <p className="text-[10px] text-slate-400 leading-relaxed uppercase">
              Ending a relationship requires mutual consent from both partners. Once accepted, all linkages are unlinked.
            </p>

            <button
              onClick={handleInitiateBreakup}
              disabled={breakupLoading || !!activeBreakup}
              className="w-full py-2.5 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-950/60 text-rose-400 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" /> End Connection Link
            </button>
          </div>
        </section>

      </main>

      <Navbar />
    </div>
  );
}

// Subcomponent: Individual Preference Wants Card
interface WantCardProps {
  want: Want;
  isMine: boolean;
  revealed: boolean;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void;
}

const WantCard: React.FC<WantCardProps> = ({ want, isMine, revealed, onReveal, onDelete }) => {
  const isBlurred = want.is_sensitive && !revealed;
  
  // Find category emoji/label
  const categoryLabel = CATEGORIES.find((c) => c.value === want.category)?.label || want.category;

  return (
    <div className="p-3 bg-slate-900/50 border border-white/5 rounded-xl flex items-center justify-between gap-3 relative overflow-hidden group">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider font-semibold font-mono text-slate-500">
            {categoryLabel}
          </span>
          {want.is_sensitive && (
            <span className="inline-flex p-0.5 bg-brand-violet/10 text-brand-violet border border-brand-violet/20 rounded">
              <Lock className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        <p 
          className={`text-xs text-slate-200 transition-all duration-300 select-all ${
            isBlurred ? 'blur-md select-none pointer-events-none' : ''
          }`}
        >
          {want.content}
        </p>

        {isBlurred && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center text-[10px] text-slate-400 select-none cursor-pointer" onClick={() => onReveal(want.id)}>
            <EyeOff className="w-3 h-3 mr-1" /> Tap to reveal want
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 z-10">
        {want.is_sensitive && !isBlurred && (
          <button
            onClick={() => onReveal(want.id)}
            className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-slate-300 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {isMine && (
          <button
            onClick={() => onDelete(want.id)}
            className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-rose-400 transition cursor-pointer"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
