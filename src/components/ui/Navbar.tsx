'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Home, Compass, Grid, Edit3, BookOpen, Settings, 
  ShieldCheck 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Galaxy', path: '/galaxy', icon: Compass },
    { name: 'Sandbox', path: '/sandbox', icon: Grid },
    { name: 'Live Canvas', path: '/canvas', icon: Edit3 },
    { name: 'Diary & Voice', path: '/journal', icon: BookOpen },
    { name: 'Safe Space', path: '/safe-space', icon: ShieldCheck },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Floating Navbar */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl glass rounded-full px-6 py-3 flex items-center justify-between border border-white/10 shadow-2xl">
        <div className="flex items-center gap-1.5 md:gap-4 justify-around w-full">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link key={item.path} href={item.path} className="relative group p-2 rounded-full transition">
                {isActive && (
                  <motion.div
                    layoutId="active-nav-glow"
                    className="absolute inset-0 bg-brand-violet/20 border border-brand-violet/40 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 transition relative z-10 ${isActive ? 'text-brand-fuchsia' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 text-[10px] text-slate-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none whitespace-nowrap">
                  {item.name}
                </span>
              </Link>
            );
          })}

        </div>
      </nav>
    </>
  );
}
