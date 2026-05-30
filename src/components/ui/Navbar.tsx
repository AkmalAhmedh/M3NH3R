'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Compass, Grid, Edit3, BookOpen, Settings, MessageSquare, 
  Send, Sparkles, X, User, LogOut, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function Navbar() {
  const pathname = usePathname();
  const { profile, partnerProfile, logOut } = useApp();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    { sender: 'ai', text: `Hello! I'm your AI Memory Assistant. Ask me anything about your shared universe (e.g., "What was our first movie?" or "Show our trip memories").` }
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Galaxy', path: '/galaxy', icon: Compass },
    { name: 'Sandbox', path: '/sandbox', icon: Grid },
    { name: 'Live Canvas', path: '/canvas', icon: Edit3 },
    { name: 'Diary & Voice', path: '/journal', icon: BookOpen },
    { name: 'Safe Space', path: '/safe-space', icon: ShieldCheck },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setAiLoading(true);

    try {
      // Build search context from client data
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userText,
          coupleId: profile?.couple_id
        })
      });

      const data = await response.json();
      setChatHistory(prev => [...prev, { sender: 'ai', text: data.answer || "I checked our stars, but couldn't find an answer. Try adding more memories!" }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: "Unable to reach the stars right now. Please check your internet connection." }]);
    } finally {
      setAiLoading(false);
    }
  };

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

          <div className="h-6 w-px bg-white/10 mx-1" />

          {/* AI Helper Toggle */}
          <button
            onClick={() => setChatOpen(true)}
            className="p-2 bg-gradient-to-r from-brand-violet to-brand-fuchsia rounded-full hover:opacity-90 transition relative group cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-white" />
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 text-[10px] text-slate-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none whitespace-nowrap">
              AI Assistant
            </span>
          </button>
        </div>
      </nav>

      {/* AI Assistant Drawer */}
      <AnimatePresence>
        {chatOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Sidebar drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-950/95 border-l border-white/10 z-50 shadow-2xl flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-violet animate-pulse" />
                  <span className="font-semibold text-glow-violet">AI Memory Star Assistant</span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat History */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {chatHistory.map((chat, idx) => (
                  <div key={idx} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        chat.sender === 'user'
                          ? 'bg-brand-violet/30 border border-brand-violet/50 text-white rounded-br-none'
                          : 'bg-slate-900 border border-white/5 text-slate-300 rounded-bl-none'
                      }`}
                    >
                      {chat.text}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900 border border-white/5 text-slate-400 rounded-2xl rounded-bl-none px-4 py-2.5 text-sm flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      Reading the constellations...
                    </div>
                  </div>
                )}
              </div>

              {/* Form Input */}
              <form onSubmit={handleAskAI} className="p-4 border-t border-white/5 bg-slate-900/20 flex gap-2">
                <input
                  type="text"
                  required
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your relationship history..."
                  className="flex-1 glass-input px-4 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !chatInput.trim()}
                  className="p-2 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-lg hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
