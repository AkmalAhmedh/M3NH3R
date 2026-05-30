'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Compass } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
      <div className="text-center space-y-3">
        <Compass className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
        <p className="text-xs text-slate-400 uppercase tracking-widest">Opening Universe Gateway...</p>
      </div>
    </div>
  );
}
