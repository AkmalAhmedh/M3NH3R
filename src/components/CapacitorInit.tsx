'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // Only runs inside Capacitor native shell (not browser)
      if (typeof window === 'undefined') return;

      // Dynamically import Capacitor plugins — they're no-ops in browser
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      const { SplashScreen } = await import('@capacitor/splash-screen');
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      const { App } = await import('@capacitor/app');

      // Hide splash screen after app is ready
      await SplashScreen.hide({ fadeOutDuration: 400 });

      // Dark status bar to match our dark theme
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#020617' });

      // Handle Android hardware back button
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          router.back();
        } else {
          App.exitApp();
        }
      });
    };

    init().catch(console.error);
  }, [router]);

  return null;
}
