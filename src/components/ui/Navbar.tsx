'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Home, Compass, Grid, Edit3, BookOpen, Settings,
  ShieldCheck, Gamepad2
} from 'lucide-react';

const menuItems = [
  { name: 'Home', path: '/dashboard', icon: Home, color: '#d946ef' },
  { name: 'Galaxy', path: '/galaxy', icon: Compass, color: '#7c3aed' },
  { name: 'Sandbox', path: '/sandbox', icon: Grid, color: '#06b6d4' },
  { name: 'Canvas', path: '/canvas', icon: Edit3, color: '#d946ef' },
  { name: 'Games', path: '/games', icon: Gamepad2, color: '#22c55e' },
  { name: 'Diary', path: '/journal', icon: BookOpen, color: '#06b6d4' },
  { name: 'Vault', path: '/safe-space', icon: ShieldCheck, color: '#f59e0b' },
  { name: 'Settings', path: '/settings', icon: Settings, color: '#94a3b8' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    // navbar-safe adds padding-bottom: max(safe-area-inset-bottom, 12px)
    // so on iPhone the navbar sits above the home indicator bar
    <nav className="fixed bottom-0 left-0 right-0 z-40 navbar-safe px-3 pb-3 pt-0">
      <div className="max-w-xl mx-auto relative">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full bg-brand-violet/10 blur-xl pointer-events-none" />

        <div className="relative glass-intense rounded-full px-4 py-3 flex items-center justify-around border border-white/10 shadow-2xl shadow-black/50">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className="relative group flex flex-col items-center gap-0.5 p-2 rounded-full transition-all duration-200"
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${item.color}25 0%, transparent 70%)`,
                      border: `1px solid ${item.color}40`,
                      boxShadow: `0 0 15px ${item.color}30, inset 0 0 10px ${item.color}10`,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon
                  className="w-5 h-5 transition-all duration-200 relative z-10"
                  style={
                    isActive
                      ? { color: item.color, filter: `drop-shadow(0 0 6px ${item.color})` }
                      : { color: '#64748b' }
                  }
                />
                <span
                  className="text-[8px] font-semibold tracking-wider uppercase relative z-10 transition-all duration-200"
                  style={isActive ? { color: item.color } : { color: '#475569' }}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
