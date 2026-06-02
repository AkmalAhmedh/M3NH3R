'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Compass, ShieldAlert, RotateCcw, LogIn } from 'lucide-react';
import { db } from '@/lib/db';

export default function Home() {
  const router = useRouter();
  const { user, profile, loading, logOut } = useApp();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Capture global window errors to help diagnose issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorMessage(event.message || 'Unknown runtime error');
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Try to softly auto-redirect if we know they are logged in and loading is complete
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleReset = async () => {
    try {
      await logOut();
      window.location.href = '/login';
    } catch (err) {
      alert('Failed to reset: ' + err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-brand-violet/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-brand-cyan/5 rounded-full filter blur-3xl pointer-events-none" />

      <div className="text-center space-y-8 z-10 max-w-md w-full glass p-10 rounded-3xl border border-white/5 shadow-2xl">
        
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-brand-cyan/10 rounded-full">
            <Compass className="w-12 h-12 text-brand-cyan" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-widest bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia bg-clip-text text-transparent">
            OUR UNIVERSE
          </h1>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">
            Premium Relationship OS
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-left">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 font-mono">{errorMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 pt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3.5 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-xl font-semibold hover:opacity-90 transition duration-300 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4" /> Enter Universe Dashboard
          </button>
          
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3.5 glass hover:bg-white/10 text-white rounded-xl font-semibold transition duration-300 flex items-center justify-center gap-2 cursor-pointer border border-white/5"
          >
            <LogIn className="w-4 h-4" /> Sign In / Create Account
          </button>

          <button
            onClick={handleReset}
            className="w-full py-3 mt-4 flex items-center justify-center gap-1.5 text-slate-500 hover:text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Current Session
          </button>
        </div>
      </div>
    </div>
  );
}

