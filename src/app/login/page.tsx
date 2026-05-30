'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Sparkles, Volume2, VolumeX, Moon, UserPlus, LogIn, Compass } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const { user, isDemo, loading } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Background star drifter simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const stars: { x: number; y: number; radius: number; speed: number; opacity: number }[] = [];
    const count = 100;

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.4,
        opacity: 0.1 + Math.random() * 0.8
      });
    }

    const draw = () => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Draw faint nebula clouds
      const grad = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height));
      grad.addColorStop(0, 'rgba(124, 58, 237, 0.08)'); // Brand Violet
      grad.addColorStop(0.5, 'rgba(217, 70, 239, 0.04)'); // Brand Fuchsia
      grad.addColorStop(1, 'rgba(2, 6, 23, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      ctx.fillStyle = '#ffffff';
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.globalAlpha = star.opacity;
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        // Move stars
        star.y -= star.speed;
        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }
      });
      ctx.globalAlpha = 1.0;

      animationId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/onboarding');
    }
  }, [user, loading, router]);

  const handleAudioToggle = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
      setIsMuted(!isMuted);
    }
  };

  const handleDemoLogin = async () => {
    setFormLoading(true);
    // Simulate interactive login
    const demoUser = {
      id: `user-${Math.floor(1000 + Math.random() * 9000)}`,
      email: 'cosmic@universe.love',
      username: username || 'StarGazer'
    };

    // Save profile to local storage profiles list
    const profiles = JSON.parse(localStorage.getItem('universe_db_profiles') || '[]');
    const existing = profiles.find((p: any) => p.email === demoUser.email);
    if (!existing) {
      profiles.push({
        id: demoUser.id,
        couple_id: null,
        email: demoUser.email,
        username: demoUser.username,
        avatar_url: null,
        mood: 'Affectionate',
        mood_emoji: '🥰',
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      localStorage.setItem('universe_db_profiles', JSON.stringify(profiles));
    } else {
      demoUser.id = existing.id;
    }

    localStorage.setItem('universe_session_user', JSON.stringify(demoUser));
    
    // Smooth transition simulation
    setTimeout(() => {
      setFormLoading(false);
      window.location.href = '/onboarding';
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setFormLoading(true);

    if (isDemo) {
      // Demo authentication helper
      handleDemoLogin();
      return;
    }

    try {
      if (isSignUp) {
        // Supabase sign up
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
            }
          }
        });
        if (error) throw error;
        setInfoMsg('Verification email sent! Check your inbox to complete sign up.');
      } else {
        // Supabase login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/onboarding');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col justify-center items-center">
      {/* 2D Canvas Star Drifter */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Background Synth Music Loop */}
      <audio
        ref={audioRef}
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
        loop
        preload="auto"
      />

      {/* Audio toggle widget */}
      <button
        onClick={handleAudioToggle}
        className="absolute top-6 right-6 z-20 glass p-3 rounded-full hover:bg-white/10 transition duration-300"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-slate-400" /> : <Volume2 className="w-5 h-5 text-brand-fuchsia animate-pulse" />}
      </button>

      {/* Glowing Star Header */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="z-10 text-center mb-8"
      >
        <div className="flex justify-center items-center gap-2 mb-2">
          <Moon className="w-8 h-8 text-brand-cyan animate-pulse" />
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-widest bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia bg-clip-text text-transparent">
            OUR UNIVERSE
          </h1>
        </div>
        <p className="text-slate-400 font-light text-sm tracking-wider uppercase">
          Premium Cinematic Relationship OS
        </p>
      </motion.div>

      {/* Interactive Authentication Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.6 }}
          className="z-10 w-11/12 max-w-md p-8 glass rounded-2xl relative shadow-2xl overflow-hidden border border-white/10"
        >
          {/* Decorative neon gradient overlays */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-brand-violet/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-brand-cyan/20 rounded-full blur-2xl" />

          <h2 className="text-xl font-medium mb-6 text-center text-slate-200">
            {isSignUp ? 'Create your celestial gateway' : 'Welcome to your shared universe'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs uppercase text-slate-400 tracking-wider mb-1">Username</label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs uppercase text-slate-400 tracking-wider mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase text-slate-400 tracking-wider mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
                />
              </div>
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-rose-400 text-center"
              >
                {errorMsg}
              </motion.div>
            )}

            {infoMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-400 text-center"
              >
                {infoMsg}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-3 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-lg font-medium hover:opacity-90 transition duration-300 shadow-lg text-sm flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {formLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" /> Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Enter Portal
                </>
              )}
            </button>
          </form>

          {isDemo && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={formLoading}
                className="w-full py-2.5 bg-brand-cyan/20 border border-brand-cyan/40 hover:bg-brand-cyan/30 text-brand-cyan rounded-lg font-medium transition duration-300 text-xs flex justify-center items-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 animate-spin-slow" /> Quick Guest Demo Login
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-between text-xs text-slate-400">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="hover:text-brand-fuchsia transition cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-6 z-10 text-xs text-slate-500">
        Created with love for partners who create galaxies.
      </div>
    </div>
  );
}
