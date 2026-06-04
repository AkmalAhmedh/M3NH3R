'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Sparkles, Volume2, VolumeX, Heart, UserPlus, LogIn, ShieldAlert } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { db } from '@/lib/db';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (formLoading) {
      timer = setTimeout(() => { setShowDiagnostics(true); }, 5000);
    }
    return () => { clearTimeout(timer); setShowDiagnostics(false); };
  }, [formLoading]);

  // Enhanced star field with shooting stars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const stars: { x: number; y: number; radius: number; speed: number; opacity: number; twinkleOffset: number }[] = [];
    const shootingStars: { x: number; y: number; length: number; speed: number; angle: number; opacity: number; active: boolean }[] = [];
    const count = 150;

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.2,
        speed: 0.05 + Math.random() * 0.2,
        opacity: 0.1 + Math.random() * 0.9,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 5; i++) {
      shootingStars.push({ x: 0, y: 0, length: 0, speed: 0, angle: 0, opacity: 0, active: false });
    }

    let frame = 0;
    const launchShootingStar = (s: typeof shootingStars[0]) => {
      s.x = Math.random() * width * 0.6;
      s.y = Math.random() * height * 0.4;
      s.length = 80 + Math.random() * 120;
      s.speed = 8 + Math.random() * 12;
      s.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.4;
      s.opacity = 1;
      s.active = true;
    };

    const draw = () => {
      frame++;
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Nebula gradient
      const grad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height));
      grad.addColorStop(0, 'rgba(124, 58, 237, 0.1)');
      grad.addColorStop(0.4, 'rgba(217, 70, 239, 0.05)');
      grad.addColorStop(0.7, 'rgba(6, 182, 212, 0.04)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Stars
      stars.forEach((star, i) => {
        const twinkle = 0.4 + 0.6 * Math.sin(frame * 0.02 + star.twinkleOffset + i * 0.3);
        ctx.beginPath();
        ctx.globalAlpha = star.opacity * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        star.y -= star.speed;
        if (star.y < 0) { star.y = height; star.x = Math.random() * width; }
      });

      // Shooting stars
      if (frame % 180 === 0) {
        const idle = shootingStars.find(s => !s.active);
        if (idle) launchShootingStar(idle);
      }
      shootingStars.forEach(s => {
        if (!s.active) return;
        ctx.globalAlpha = s.opacity;
        const dx = Math.cos(s.angle) * s.length;
        const dy = Math.sin(s.angle) * s.length;
        const grad2 = ctx.createLinearGradient(s.x, s.y, s.x + dx, s.y + dy);
        grad2.addColorStop(0, 'rgba(255,255,255,0)');
        grad2.addColorStop(0.4, 'rgba(6,182,212,0.6)');
        grad2.addColorStop(1, 'rgba(255,255,255,0.9)');
        ctx.beginPath();
        ctx.strokeStyle = grad2;
        ctx.lineWidth = 1.5;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + dx, s.y + dy);
        ctx.stroke();
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity -= 0.02;
        if (s.opacity <= 0) s.active = false;
      });

      ctx.globalAlpha = 1.0;
      animationId = requestAnimationFrame(draw);
    };
    draw();

    const handleResize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => { cancelAnimationFrame(animationId); window.removeEventListener('resize', handleResize); };
  }, []);

  // Smart redirect: coupled → dashboard, uncoupled → onboarding
  useEffect(() => {
    if (!loading && user) {
      // We check profile from Supabase to determine destination
      db.getCurrentProfile(user.id).then(profile => {
        if (profile?.couple_id) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      });
    }
  }, [user, loading, router]);

  const handleAudioToggle = () => {
    if (audioRef.current) {
      if (isMuted) { audioRef.current.play().catch(() => {}); }
      else { audioRef.current.pause(); }
      setIsMuted(!isMuted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setFormLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username || email.split('@')[0] } }
        });
        if (error) throw error;
        setInfoMsg('✨ Verification email sent! Check your inbox to complete sign up.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Smart redirect after login
        if (data.user) {
          const profile = await db.getCurrentProfile(data.user.id);
          if (profile?.couple_id) {
            router.replace('/dashboard');
          } else {
            router.replace('/onboarding');
          }
        }
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An error occurred during authentication.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-center items-center">
      {/* Star Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
      <audio ref={audioRef} src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" loop preload="auto" />

      {/* Audio toggle */}
      <button
        onClick={handleAudioToggle}
        className="absolute top-6 right-6 z-20 glass p-3 rounded-full hover:bg-white/10 transition duration-300 glow-border-violet"
        title="Toggle ambient music"
      >
        {isMuted
          ? <VolumeX className="w-5 h-5 text-slate-400" />
          : <Volume2 className="w-5 h-5 text-brand-fuchsia animate-pulse" />}
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="z-10 text-center mb-8"
      >
        <div className="flex justify-center items-center gap-3 mb-3">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Heart className="w-8 h-8 text-brand-fuchsia fill-brand-fuchsia icon-glow-fuchsia" />
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black tracking-widest bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia bg-clip-text text-transparent"
            style={{ fontFamily: 'Outfit, sans-serif' }}>
            M3NH3R
          </h1>
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <Heart className="w-8 h-8 text-brand-fuchsia fill-brand-fuchsia icon-glow-fuchsia" />
          </motion.div>
        </div>
        <p className="text-slate-400 font-light text-sm tracking-[0.3em] uppercase">
          Your Private Universe
        </p>
        <div className="mt-2 h-px w-48 mx-auto bg-gradient-to-r from-transparent via-brand-violet to-transparent" />
      </motion.div>

      {/* Auth Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isSignUp ? 'signup' : 'signin'}
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -24 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="z-10 w-11/12 max-w-md glass-aurora shadow-2xl"
        >
          <div className="p-8 relative z-10">
            {/* Decorative corners */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-violet/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-brand-gold icon-glow-gold" />
              <h2 className="text-lg font-semibold text-slate-200 tracking-wide">
                {isSignUp ? 'Create your celestial gateway' : 'Welcome back, stargazer'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-6 ml-6">
              {isSignUp ? 'Begin your shared universe today' : 'Enter your portal to reconnect'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-widest mb-1.5 font-semibold">Your Name</label>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-violet" />
                    <input
                      type="text" required value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-10 pr-4 py-3 glass-input text-sm rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase text-slate-400 tracking-widest mb-1.5 font-semibold">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full pl-10 pr-4 py-3 glass-input text-sm rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-400 tracking-widest mb-1.5 font-semibold">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 glass-input text-sm rounded-xl"
                  />
                </div>
              </div>

              {errorMsg && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {errorMsg}
                </motion.div>
              )}

              {infoMsg && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  {infoMsg}
                </motion.div>
              )}

              {showDiagnostics && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-xs">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Slow connection detected
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    The server is taking longer than expected. Check your internet connection.
                  </p>
                  <button type="button" onClick={() => setFormLoading(false)}
                    className="w-full py-1.5 px-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300 transition cursor-pointer font-semibold text-[10px]">
                    Stop Loader
                  </button>
                </motion.div>
              )}

              <button
                type="submit" disabled={formLoading}
                className="w-full py-3.5 bg-gradient-to-r from-brand-violet via-brand-fuchsia to-brand-cyan text-white rounded-xl font-semibold hover:opacity-90 transition-all duration-300 shadow-lg shadow-brand-violet/30 text-sm flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 mt-2 animate-glow-pulse"
              >
                {formLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isSignUp ? (
                  <><UserPlus className="w-4 h-4" /> Create Account</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Enter Portal</>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-white/5 flex justify-center">
              <button
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setInfoMsg(''); }}
                className="text-xs text-slate-400 hover:text-brand-fuchsia transition duration-200 cursor-pointer"
              >
                {isSignUp ? 'Already have an account? → Sign In' : "Don't have an account? → Sign Up"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-6 z-10 text-xs text-slate-600 tracking-wider">
        Created with love, for partners who create galaxies. 🌌
      </div>
    </div>
  );
}
