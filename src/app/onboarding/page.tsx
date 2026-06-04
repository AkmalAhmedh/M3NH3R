'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Copy, Check, Link2, Compass, ShieldAlert, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import confetti from 'canvas-confetti';
import { PartnerInvite, Profile } from '@/types';

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
  
  const [myInvite, setMyInvite] = useState<PartnerInvite | null>(null);
  const [sentRequest, setSentRequest] = useState<PartnerInvite | null>(null);
  const [requesterProfile, setRequesterProfile] = useState<Profile | null>(null);
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);

  const [canceling, setCanceling] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Pre-generate stars using useMemo and a pure deterministic seed to satisfy React 19 purity requirements
  const stars = React.useMemo(() => {
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: 50 }).map((_, i) => {
      const r1 = seededRandom(i + 1);
      const r2 = seededRandom(i + 2);
      const r3 = seededRandom(i + 3);
      const r4 = seededRandom(i + 4);
      const r5 = seededRandom(i + 5);
      return {
        id: i,
        width: r1 * 3 + 'px',
        height: r2 * 3 + 'px',
        top: r3 * 100 + '%',
        left: r4 * 100 + '%',
        duration: r5 * 2 + 1
      };
    });
  }, []);

  // Track if we had an active invitation or request before it was accepted
  const hadInviteOrRequest = React.useRef(false);

  useEffect(() => {
    if (sentRequest || myInvite) {
      hadInviteOrRequest.current = true;
    }
  }, [sentRequest, myInvite]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Redirect to dashboard if already linked (and not mid-cinematic)
  useEffect(() => {
    if (!loading && user && profile?.couple_id && !successLinked) {
      router.replace('/dashboard');
    }
  }, [user, profile?.couple_id, loading, router, successLinked]);

  const fetchInvites = useCallback(async () => {
    if (!user?.id) return;
    
    // Fetch invite owned by me
    const { data: myData } = await supabase
      .from('partner_invites')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();
      
    if (myData) {
      setMyInvite(myData as PartnerInvite);
      setGeneratedCode(myData.code);
      if (myData.target_user_id) {
        db.getCurrentProfile(myData.target_user_id).then(setRequesterProfile);
      } else {
        setRequesterProfile(null);
      }
    } else {
      setMyInvite(null);
    }

    // Fetch invite requested by me
    const { data: targetData } = await supabase
      .from('partner_invites')
      .select('*')
      .eq('target_user_id', user.id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (targetData) {
      setSentRequest(targetData as PartnerInvite);
      db.getCurrentProfile(targetData.owner_id).then(setTargetProfile);
    } else {
      setSentRequest(null);
    }
  }, [user]);

  const triggerCinematic = useCallback(() => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#a78bfa', '#ec4899', '#38bdf8', '#fbbf24']
    });
    setSuccessLinked(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 4000);
  }, [router]);

  useEffect(() => {
    if (user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchInvites();

      const channel = supabase.channel(`invites:${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_invites', filter: `owner_id=eq.${user.id}` }, () => {
          fetchInvites();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_invites', filter: `target_user_id=eq.${user.id}` }, () => {
          fetchInvites();
          refreshState();
        })
        .subscribe();

      // Robust fallback polling to catch state changes if Realtime is delayed or not enabled
      const interval = setInterval(() => {
        fetchInvites();
        if (hadInviteOrRequest.current) {
          refreshState();
        }
      }, 3000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [user, fetchInvites, refreshState]);

  // If a request was sent and is suddenly gone (e.g. accepted), refresh state to pick up couple_id
  useEffect(() => {
    if (!sentRequest && targetProfile && !profile?.couple_id) {
      refreshState();
    }
  }, [sentRequest, targetProfile, profile?.couple_id, refreshState]);

  // If we just got a couple_id and successLinked isn't true yet, it means our request was accepted remotely!
  useEffect(() => {
    if (profile?.couple_id && !successLinked && hadInviteOrRequest.current) {
      triggerCinematic();
    }
  }, [profile?.couple_id, successLinked, triggerCinematic]);

  const handleGenerateCode = async () => {
    if (!profile?.id) return;
    setGenLoading(true);
    setErrorMsg('');
    try {
      const code = await db.generateInviteCode(profile.id);
      setGeneratedCode(code);
      await fetchInvites();
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
      await db.requestPartnerConnection(inviteCode.trim().toUpperCase());
      await fetchInvites();
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
      await fetchInvites();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to cancel request.');
    } finally {
      setCanceling(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!myInvite) return;
    setActionLoading(true);
    try {
      await db.acceptPartnerConnection(myInvite.id);
      await refreshState();
      triggerCinematic();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to accept connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!myInvite) return;
    setActionLoading(true);
    try {
      await db.declinePartnerConnection(myInvite.id);
      await fetchInvites();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to decline connection.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || successLinked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <AnimatePresence>
          {successLinked ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
              className="text-center space-y-4 absolute inset-0 bg-slate-950 z-50 flex flex-col justify-center items-center"
            >
              {/* Cinematic Background Stars */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {stars.map((star) => (
                  <motion.div
                    key={star.id}
                    className="absolute bg-white rounded-full"
                    style={{
                      width: star.width,
                      height: star.height,
                      top: star.top,
                      left: star.left,
                    }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: star.duration, repeat: Infinity }}
                  />
                ))}
              </div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                className="z-10 text-center"
              >
                <div className="inline-flex p-8 bg-gradient-to-tr from-brand-violet to-brand-fuchsia rounded-full text-white shadow-2xl relative">
                  <Heart className="w-16 h-16 fill-white animate-pulse" />
                  <Sparkles className="w-8 h-8 text-brand-gold absolute -top-1 -right-1 animate-bounce" />
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="z-10"
              >
                <h2 className="text-3xl md:text-5xl font-extrabold text-glow-violet bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia bg-clip-text text-transparent mb-4 tracking-widest">
                  {profile?.username} ✦ {requesterProfile?.username || targetProfile?.username || 'Partner'}
                </h2>
                <p className="text-slate-300 max-w-md font-light leading-relaxed mx-auto text-lg">
                  A new universe has been created.
                </p>
                <div className="w-32 h-1 bg-gradient-to-r from-brand-cyan to-brand-fuchsia mx-auto mt-6 rounded-full animate-pulse" />
              </motion.div>
            </motion.div>
          ) : (
            <div className="text-center space-y-4">
              <Compass className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
              <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">Opening Universe Gateway...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Phase 3: Owner receiving a request
  if (myInvite?.target_user_id && requesterProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-violet/20 rounded-full filter blur-[100px] pointer-events-none animate-pulse" />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass p-8 md:p-12 rounded-3xl border border-brand-violet/30 shadow-2xl max-w-lg w-full text-center relative z-10"
        >
          <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-brand-cyan to-brand-violet rounded-full flex items-center justify-center mb-6 shadow-lg shadow-brand-violet/20">
            <Link2 className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4 text-white">Connection Request</h2>
          <p className="text-slate-300 text-lg mb-8 leading-relaxed">
            <span className="font-bold text-brand-cyan">{requesterProfile.username || requesterProfile.email.split('@')[0]}</span> wants to connect with you.
          </p>
          
          <div className="flex gap-4">
            <button 
              onClick={handleDeclineRequest}
              disabled={actionLoading}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition disabled:opacity-50"
            >
              Decline
            </button>
            <button 
              onClick={handleAcceptRequest}
              disabled={actionLoading}
              className="flex-1 py-3 bg-gradient-to-r from-brand-cyan to-brand-violet text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-brand-violet/20 disabled:opacity-50"
            >
              Accept
            </button>
          </div>
          
          {errorMsg && <p className="text-rose-400 mt-4 text-sm">{errorMsg}</p>}
        </motion.div>
      </div>
    );
  }

  // Phase 2: Requester waiting for approval
  if (sentRequest) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-violet/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-fuchsia/10 rounded-full filter blur-3xl pointer-events-none" />

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

        <div className="flex-1 flex flex-col justify-center items-center z-10 my-8 animate-fadeIn">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full text-center relative overflow-hidden"
          >
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-brand-cyan/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-brand-violet/10 rounded-full blur-2xl" />

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
              Awaiting Approval
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              You requested connection with <span className="text-brand-cyan font-semibold">@{targetProfile?.username || 'your partner'}</span>.
              Waiting for them to accept the request.
            </p>

            {errorMsg && <div className="text-xs text-rose-400 mb-4">{errorMsg}</div>}

            <button
              onClick={handleCancelRequest}
              disabled={canceling}
              className="w-full py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {canceling ? 'Canceling...' : 'Cancel Request'}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Phase 1: Generate or Enter Code
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-violet/10 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-fuchsia/10 rounded-full filter blur-3xl pointer-events-none" />

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
    </div>
  );
}
