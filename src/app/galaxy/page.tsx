'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Plus, X, Calendar, Image as ImageIcon, MapPin, Tag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import Galaxy from '@/components/universe/Galaxy';
import Navbar from '@/components/ui/Navbar';
import { Memory } from '@/types';
import { motion as framerMotion, AnimatePresence } from 'framer-motion';

export default function GalaxyPage() {
  const router = useRouter();
  const { user, profile, loading } = useApp();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Memory['category']>('Date');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!profile?.couple_id) {
        router.push('/onboarding');
      }
    }
  }, [user, profile, loading, router]);

  const loadMemories = useCallback(async () => {
    if (!profile?.couple_id) return;
    const mems = await db.getMemories(profile.couple_id);
    setMemories(mems);
  }, [profile]);

  useEffect(() => {
    if (profile?.couple_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadMemories();
    }
  }, [profile, loadMemories]);

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !profile?.id || !title) return;
    setFormLoading(true);

    try {
      const paths = imageUrl ? [{ path: imageUrl, type: 'image' as const }] : [];
      await db.addMemory(profile.couple_id, profile.id, title, content, category, date, paths);
      
      // Reset form & close modal
      setTitle('');
      setContent('');
      setImageUrl('');
      setCategory('Date');
      setModalOpen(false);
      
      // Refresh memory list
      await loadMemories();
    } catch (err) {
      console.error('Failed to create memory star:', err);
    } finally {
      setFormLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="text-center space-y-3">
          <Compass className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
          <p className="text-xs text-slate-400 uppercase tracking-widest">Warping to your Galaxy coordinates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-slate-950 flex flex-col justify-between">
      
      {/* 3D Canvas Explorer */}
      <div className="absolute inset-0 z-0">
        <Galaxy memories={memories} onSelectMemory={(mem) => setSelectedMemory(mem)} />
      </div>

      {/* Floating Header */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-xl font-bold tracking-wider text-glow-cyan text-brand-cyan flex items-center gap-1.5">
          <Compass className="w-5 h-5" /> MEMORY STAR GALAXY
        </h1>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
          {memories.length} stars archived in orbit
        </p>
      </div>

      {/* Action Button: Add Star */}
      <button
        onClick={() => setModalOpen(true)}
        className="absolute top-6 right-6 z-10 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white p-3 rounded-full hover:opacity-90 transition duration-300 shadow-lg cursor-pointer flex items-center gap-1 text-xs font-semibold"
      >
        <Plus className="w-4 h-4" /> Add Memory Star
      </button>

      {/* Detail Overlay Drawer */}
      <AnimatePresence>
        {selectedMemory && (
          <framerMotion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-full max-w-sm glass-intense border-l border-white/10 z-20 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-brand-fuchsia bg-brand-fuchsia/10 border border-brand-fuchsia/20 px-3 py-1 rounded-full">
                  {selectedMemory.category}
                </span>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-200">{selectedMemory.title}</h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedMemory.date}</span>
                </div>
              </div>

              {selectedMemory.assets && selectedMemory.assets.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40">
                  <img
                    src={selectedMemory.assets[0].file_path}
                    alt={selectedMemory.title}
                    className="w-full h-44 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=600';
                    }}
                  />
                </div>
              )}

              <p className="text-slate-300 text-xs leading-relaxed font-light whitespace-pre-line bg-white/5 p-4 rounded-xl border border-white/5">
                {selectedMemory.content || 'A silent star floats here with no words.'}
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-white/5 text-[10px] text-slate-500 text-center">
              Click away to return to the galaxy navigation.
            </div>
          </framerMotion.div>
        )}
      </AnimatePresence>

      {/* Modal: Create Star Memory */}
      <AnimatePresence>
        {modalOpen && (
          <div className="absolute inset-0 bg-black/70 z-30 flex justify-center items-center p-4">
            <framerMotion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md p-6 glass-intense rounded-2xl border border-white/10 shadow-2xl relative"
            >
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-lg font-bold mb-4 bg-gradient-to-r from-brand-cyan to-brand-fuchsia bg-clip-text text-transparent flex items-center gap-1">
                <Compass className="w-5 h-5 text-brand-cyan" /> Spawn a New Memory Star
              </h2>

              <form onSubmit={handleCreateMemory} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Watched the Sunset"
                    className="w-full py-2 px-3 glass-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Memory['category'])}
                      className="w-full py-2 px-3 glass-input text-xs bg-slate-900"
                    >
                      <option value="Date">Date</option>
                      <option value="Travel">Travel</option>
                      <option value="Movie">Movie</option>
                      <option value="Game">Game</option>
                      <option value="Food">Food</option>
                      <option value="Call">Call</option>
                      <option value="Gift">Gift</option>
                      <option value="Personal">Personal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full py-2 px-3 glass-input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Photo URL (Optional)</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full py-2 px-3 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Star Memory Notes</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Describe this beautiful moment..."
                    rows={3}
                    className="w-full py-2 px-3 glass-input text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia text-white rounded-lg text-xs font-semibold hover:opacity-90 transition duration-300 shadow cursor-pointer flex justify-center items-center"
                >
                  {formLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Synthesize Star Star Star'
                  )}
                </button>
              </form>
            </framerMotion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}
