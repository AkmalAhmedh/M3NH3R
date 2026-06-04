'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Home() {
  const router = useRouter();
  const { user, profile, loading } = useApp();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (profile?.couple_id) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  // Show nothing while redirecting — avoids flash
  return null;
}
