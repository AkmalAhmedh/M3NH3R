'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Copy, Check, Link2, Compass, ShieldAlert, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import confetti from 'canvas-confetti';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, logOut, refreshState } = useApp();

  const [inviteCode, setInviteCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successLinked, setSuccessLinked] = useState(false);
  const [pendingPartnerName, setPendingPartnerName] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const [wasWaiting, setWasWaiting] = useState(false);

  // Track if we were waiting for partner sync
  useEffect(() => {
    if (profile && !profile.couple_id) {
      setWasWaiting(true);
    }
  }, [profile]);

  // Redirect to login if unauthenticated, or to dashboard if already linked
  useEffect(() => {
    if (!loading && user) {
      if (profile?.couple_id) {
        if (wasWaiting && !successLinked) {
          // Connection success! Trigger confetti and transition to dashboard
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#a78bfa', '#ec4899', '#38bdf8', '#fbbf24']
          });
          setSuccessLinked(true);
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else if (!successLinked) {
          router.push('/dashboard');
        }
      }
    }
  }, [user, profile, loading, router, wasWaiting, successLinked]);

  // Retrieve or auto-generate active invite code on load
  useEffect(() => {
    if (profile?.id) {
      db.getInviteCode(profile.id).then(async (code) => {
        if (code) {
          setGeneratedCode(code);
        } else {
          try {
            const newCode = await db.generateInviteCode(profile.id);
            setGeneratedCode(newCode);
          } catch (err) {
            console.error('Failed to auto-generate code:', err);
          }
        }
      });
    }
  }, [profile?.id]);

  // Load pending partner username if pending link exists
  useEffect(() => {
    if (profile?.pending_partner_id) {
      db.getCurrentProfile(profile.pending_partner_id).then((p) => {
        if (p) setPendingPartnerName(p.username || p.email.split('@')[0]);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingPartnerName(null);
    }
  }, [profile?.pending_partner_id]);

  // Fallback polling: Check profile status periodically if we are waiting for partner coupling
  useEffect(() => {
    if (!profile?.pending_partner_id || successLinked) return;

    const interval = setInterval(async () => {
      try {
        await refreshState();
      } catch (err) {
        console.error('Polling error while refreshing onboarding state:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [profile?.pending_partner_id, refreshState, successLinked]);

  const handleGenerateCode = async () => {
    if (!profile?.id) return;
    setGenLoading(true);
    setErrorMsg('');
    try {
      const code = await db.generateInviteCode(profile.id);
      setGeneratedCode(code);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to generate code.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !inviteCode) return;
    setLinkingLoading(true);
    setErrorMsg('');
    try {
      const res = await db.linkPartner(profile.id, inviteCode.trim().toUpperCase());
      
      if (res.linked) {
        // Connection Confetti Trigger!
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#a78bfa', '#ec4899', '#38bdf8', '#fbbf24']
        });
        setSuccessLinked(true);
      }
      
      await refreshState();

      if (res.linked) {
        // Delay redirect to let them enjoy the success state
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to link partner. Verify the code.');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!profile?.id) return;
    setCanceling(true);
    setErrorMsg('');
    try {
      await db.cancelPendingLink(profile.id);
      await refreshState();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to cancel request.');
    } finally {
      setCanceling(false);
    }
  };

  if (loading || successLinked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <AnimatePresence>
          {successLinked ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center space-y-4"
            >
              <div className="inline-flex p-6 bg-gradient-to-tr from-brand-violet to-brand-fuchsia rounded-full text-white shadow-2xl relative">
                <Heart className="w-12 h-12 fill-white animate-pulse" />
                <Sparkles className="w-6 h-6 text-brand-gold absolute -top-1 -right-1 animate-bounce" />
              </div>
              <h2 className="text-3xl font-extrabold text-glow-violet bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia bg-clip-text text-transparent">
                UNIVERSE ESTABLISHED
              </h2>
              <p className="text-slate-300 max-w-sm font-light leading-relaxed">
                Your heart pathways have been bound together. Preparing flight path into your shared galaxy...
              </p>
              <div className="w-24 h-1 bg-gradient-to-r from-brand-cyan to-brand-fuchsia mx-auto mt-4 rounded-full animate-pulse" />
            </motion.div>
          ) : (
            <div className="text-center space-y-4">
              <Compass className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
              <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">Opening Universe Gateway...</p>
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
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (profile?.pending_partner_id) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-violet/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-fuchsia/10 rounded-full filter blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex justify-between items-center z-10 w-full">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-brand-cyan" />
            <span className="text-sm font-semibold tracking-wider bg-gradient-to-r from-brand-cyan to-brand-violet bg-clip-text text-transparent">
              ORBITAL SYNC GATEWAY
            </span>
          </div>
          <button
            onClick={() => logOut()}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1.5 glass px-3 py-1.5 rounded-full transition duration-300 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Disconnect
          </button>
        </div>

        {/* Pending Sync Card */}
        <div className="flex-1 flex flex-col justify-center items-center z-10 my-8 animate-fadeIn">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full text-center relative overflow-hidden"
          >
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-brand-cyan/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-brand-violet/10 rounded-full blur-2xl" />

            {/* Spinning orbital animation */}
            <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 border border-brand-cyan/20 rounded-full" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="absolute inset-0 border-t-2 border-brand-cyan rounded-full"
              />
              <div className="absolute w-20 h-20 border border-brand-violet/20 rounded-full" />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="absolute w-20 h-20 border-b-2 border-brand-violet rounded-full"
              />
              <Heart className="w-8 h-8 text-brand-fuchsia fill-brand-fuchsia/40 animate-pulse relative z-10" />
            </div>

            <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-brand-cyan to-brand-fuchsia bg-clip-text text-transparent">
              Waiting for Partner Sync
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              You requested connection with <span className="text-brand-cyan font-semibold">@{pendingPartnerName || 'your partner'}</span>.
              To complete the link, they must log in and enter your Space Code below:
            </p>

            {/* Display my code for partner to use */}
            <div className="mb-6 p-4 bg-slate-900/50 border border-white/5 rounded-xl">
              <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Your Space Code</span>
              <span className="text-2xl font-black text-brand-violet tracking-widest font-mono">
                {generatedCode || 'Loading...'}
              </span>
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-400 mb-4">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleCancelRequest}
              disabled={canceling}
              className="w-full py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {canceling ? 'Canceling...' : 'Cancel Sync Request'}
            </button>
          </motion.div>
        </div>

        <div className="text-center text-xs text-slate-500 z-10">
          Once both devices have connected, you will be redirected to your galaxy dashboard automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-violet/10 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-fuchsia/10 rounded-full filter blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex justify-between items-center z-10 w-full">
        <div className="flex items-center gap-2">
          <Compass className="w-6 h-6 text-brand-cyan" />
          <span className="text-sm font-semibold tracking-wider bg-gradient-to-r from-brand-cyan to-brand-violet bg-clip-text text-transparent">
            OUR UNIVERSE
          </span>
        </div>
        <button
          onClick={() => logOut()}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1.5 glass px-3 py-1.5 rounded-full transition duration-300 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Disconnect
        </button>
      </div>

      {/* Main Linking Section */}
      <div className="flex-1 flex flex-col justify-center items-center z-10 my-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-2xl text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Connect Your Hearts
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto font-light leading-relaxed">
            Every galaxy requires two celestial bodies to orbit each other. Share your code or enter your partner&apos;s code to begin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          {/* Card 1: Generate Code */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="glass p-6 md:p-8 rounded-2xl border border-white/5 flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-10 h-10 rounded-full bg-brand-violet/20 flex items-center justify-center text-brand-violet mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Send Invite Code</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Create a unique code linked to your account. Send it to your partner to let them join your space orbit.
              </p>
            </div>

            <div className="space-y-4">
              {generatedCode ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 py-3 px-4 glass bg-slate-900/50 rounded-xl font-mono text-center text-lg font-bold text-brand-violet tracking-widest border border-brand-violet/30">
                    {generatedCode}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 hover:text-white transition duration-200 text-slate-300 cursor-pointer"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCode}
                  disabled={genLoading}
                  className="w-full py-3 bg-brand-violet/20 border border-brand-violet/30 hover:bg-brand-violet/30 text-brand-violet rounded-xl font-semibold text-sm transition duration-300 cursor-pointer disabled:opacity-50"
                >
                  {genLoading ? 'Generating Code...' : 'Generate My Space Code'}
                </button>
              )}
            </div>
          </motion.div>

          {/* Card 2: Enter Partner's Code */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="glass p-6 md:p-8 rounded-2xl border border-white/5 flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-10 h-10 rounded-full bg-brand-cyan/20 flex items-center justify-center text-brand-cyan mb-4">
                <Link2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Enter Partner&apos;s Code</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                If your partner has generated an invite code, enter it below to request instant coupling.
              </p>
            </div>

            <form onSubmit={handleLinkPartner} className="space-y-4">
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. STAR-4837"
                className="w-full py-3 px-4 glass-input font-mono text-center text-lg font-bold tracking-widest placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
              />

              {errorMsg && (
                <div className="text-xs text-rose-400 text-center flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={linkingLoading || !inviteCode}
                className="w-full py-3 bg-gradient-to-r from-brand-cyan to-brand-violet text-white font-semibold text-sm rounded-xl hover:opacity-95 transition duration-300 shadow-md flex justify-center items-center cursor-pointer disabled:opacity-50"
              >
                {linkingLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Connect Partner'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>

      {/* Footnote instruction */}
      <div className="text-center text-xs text-slate-500 z-10">
        Need help? Have your partner generate a code, then copy it here exactly.
      </div>
    </div>
  );
}
