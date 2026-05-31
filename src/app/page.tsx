'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Compass, ShieldAlert, RotateCcw, LogIn } from 'lucide-react';
import { db } from '@/lib/db';

export default function Home() {
  const router = useRouter();
  const { user, profile, loading, logOut } = useApp();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trigger diagnostics if stuck in loading for more than 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setShowDiagnostics(true);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [loading]);

  // Capture global window errors to help diagnose issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorMessage(event.message || 'Unknown runtime error');
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
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

      <div className="text-center space-y-4 z-10 max-w-md w-full">
        <Compass className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
        <p className="text-xs text-slate-400 uppercase tracking-widest">Opening Universe Gateway...</p>

        {showDiagnostics && (
          <div className="mt-8 p-6 glass rounded-2xl border border-white/10 text-left space-y-4 animate-fadeIn shadow-2xl">
            <div className="flex items-center gap-2 text-brand-gold">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Gateway Diagnostics</h2>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              If you are stuck on this page, the application is experiencing connection or state loading delay. Here are the diagnostics:
            </p>

            <div className="space-y-1.5 font-mono text-[10px] bg-black/40 p-3 rounded-xl border border-white/5 text-slate-300">
              <div><span className="text-slate-500">Supabase Connected:</span> {db.isSupabase() ? 'TRUE' : 'FALSE'}</div>
              <div><span className="text-slate-500">Auth User:</span> {user ? `Logged In (${user.email})` : 'NULL'}</div>
              <div><span className="text-slate-500">Profile Loaded:</span> {profile ? `Yes (${profile.username})` : 'NULL'}</div>
              <div><span className="text-slate-500">Couple ID:</span> {profile?.couple_id || 'NULL'}</div>
              <div><span className="text-slate-500">Loading State:</span> {loading ? 'TRUE' : 'FALSE'}</div>
              {errorMessage && (
                <div className="text-rose-400 mt-2 border-t border-white/5 pt-1.5">
                  <span className="text-slate-500 block">Console Error:</span>
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  if (user) router.push('/dashboard');
                  else router.push('/login');
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan rounded-xl text-xs font-semibold hover:bg-brand-cyan/30 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Skip to App
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
