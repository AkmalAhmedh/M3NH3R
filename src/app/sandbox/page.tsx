'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, X, Calendar, Image as ImageIcon, Sparkles, 
  ChevronRight, ChevronLeft, ArrowRight, ArrowLeft, Star, Heart 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import Navbar from '@/components/ui/Navbar';
import { SandboxCard } from '@/types';

export default function SandboxPage() {
  const router = useRouter();
  const { user, profile, loading } = useApp();

  const [cards, setCards] = useState<SandboxCard[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState<SandboxCard | null>(null);

  // New card form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Date');
  const [notes, setNotes] = useState('');

  // Core memory unlock form states
  const [photoUrl, setPhotoUrl] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [rating, setRating] = useState(5);
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

  const loadCards = useCallback(async () => {
    if (!profile?.couple_id) return;
    const items = await db.getSandboxCards(profile.couple_id);
    setCards(items);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCards();
  }, [loadCards]);

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !title) return;
    setFormLoading(true);

    try {
      await db.createSandboxCard(profile.couple_id, title, 'wishlist', category, { notes });
      setTitle('');
      setNotes('');
      setCategory('Date');
      setCreateOpen(false);
      await loadCards();
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleMoveCard = async (card: SandboxCard, newStatus: SandboxCard['status']) => {
    if (newStatus === 'core_memories') {
      // Trigger completion modal to add image/notes
      setCompleteOpen(card);
    } else {
      try {
        await db.updateSandboxCardStatus(card.id, newStatus);
        await loadCards();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSaveCoreMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeOpen) return;
    setFormLoading(true);

    try {
      const metadata = {
        photoUrl,
        notes: completionNotes || completeOpen.metadata.notes || '',
        date: completionDate,
        rating
      };
      
      await db.updateSandboxCardStatus(completeOpen.id, 'core_memories', metadata);
      
      setCompleteOpen(null);
      setPhotoUrl('');
      setCompletionNotes('');
      setRating(5);
      await loadCards();
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await db.deleteSandboxCard(cardId);
      await loadCards();
    } catch (err) {
      console.error(err);
    }
  };

  const wishlistCards = cards.filter(c => c.status === 'wishlist');
  const rightNowCards = cards.filter(c => c.status === 'right_now');
  const coreMemoriesCards = cards.filter(c => c.status === 'core_memories');

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="text-center space-y-3">
          <Sparkles className="w-10 h-10 text-brand-fuchsia animate-spin-slow mx-auto" />
          <p className="text-xs text-slate-400 uppercase tracking-widest">Opening Sandbox timelines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {/* Decorative gradients */}
      <div className="absolute top-0 right-1/3 w-[450px] h-[450px] bg-brand-violet/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-1/4 w-[450px] h-[450px] bg-brand-fuchsia/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Main Header */}
      <header className="max-w-6xl mx-auto px-6 pt-10 flex justify-between items-center z-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-brand-violet to-brand-fuchsia bg-clip-text text-transparent flex items-center gap-1.5">
            RELATIONSHIP SANDBOX
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Drag-free flow trackers for wishlists & active memories
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="p-3 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-full hover:opacity-90 transition duration-300 shadow cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Columns Grid */}
      <main className="max-w-6xl mx-auto px-6 mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 z-10 relative">
        
        {/* Track 1: OUR WISHLIST */}
        <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col space-y-4 min-h-[500px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-fuchsia text-glow-fuchsia">
              🌌 Our Wishlist ({wishlistCards.length})
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 max-h-[600px] pr-1">
            {wishlistCards.map((card) => (
              <SandboxCardWidget
                key={card.id}
                card={card}
                onMove={(c, status) => handleMoveCard(c, status)}
                onDelete={(id) => handleDeleteCard(id)}
                stage="wishlist"
              />
            ))}
            {wishlistCards.length === 0 && (
              <div className="text-center py-10 text-[10px] text-slate-500">
                No wishlist items logged. Click the (+) to add!
              </div>
            )}
          </div>
        </div>

        {/* Track 2: RIGHT NOW */}
        <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col space-y-4 min-h-[500px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-violet text-glow-violet">
              ⚡ Right Now ({rightNowCards.length})
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 max-h-[600px] pr-1">
            {rightNowCards.map((card) => (
              <SandboxCardWidget
                key={card.id}
                card={card}
                onMove={(c, status) => handleMoveCard(c, status)}
                onDelete={(id) => handleDeleteCard(id)}
                stage="right_now"
              />
            ))}
            {rightNowCards.length === 0 && (
              <div className="text-center py-10 text-[10px] text-slate-500">
                No active events. Move an item from the Wishlist!
              </div>
            )}
          </div>
        </div>

        {/* Track 3: CORE MEMORIES */}
        <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col space-y-4 min-h-[500px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan text-glow-cyan">
              ⭐ Core Memories ({coreMemoriesCards.length})
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 max-h-[600px] pr-1">
            {coreMemoriesCards.map((card) => (
              <SandboxCardWidget
                key={card.id}
                card={card}
                onMove={(c, status) => handleMoveCard(c, status)}
                onDelete={(id) => handleDeleteCard(id)}
                stage="core_memories"
              />
            ))}
            {coreMemoriesCards.length === 0 && (
              <div className="text-center py-10 text-[10px] text-slate-500">
                No completed memories. Move items here to build memory stars!
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Modal: Create Card */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md p-6 glass-intense rounded-2xl border border-white/10 shadow-2xl relative"
            >
              <button
                onClick={() => setCreateOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-base font-bold mb-4 flex items-center gap-1.5 text-glow-fuchsia text-brand-fuchsia">
                <Sparkles className="w-4 h-4" /> Log Wishlist Concept
              </h2>

              <form onSubmit={handleCreateCard} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Try French Bistro downtown"
                    className="w-full py-2.5 px-3 glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full py-2.5 px-3 glass-input text-xs bg-slate-900"
                  >
                    <option value="Date">Date</option>
                    <option value="Travel">Travel</option>
                    <option value="Movie">Movie</option>
                    <option value="Game">Game</option>
                    <option value="Food">Food</option>
                    <option value="Gift">Gift</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Brief Description</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="A quick note about this wish idea..."
                    rows={3}
                    className="w-full py-2.5 px-3 glass-input text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-3 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-xl text-xs font-semibold hover:opacity-90 transition duration-300 shadow cursor-pointer flex justify-center items-center"
                >
                  {formLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Add to Wishlist'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Complete Core Memory Star */}
      <AnimatePresence>
        {completeOpen && (
          <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md p-6 glass-intense rounded-2xl border border-white/10 shadow-2xl relative"
            >
              <button
                onClick={() => setCompleteOpen(null)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-base font-bold mb-2 flex items-center gap-1.5 text-glow-cyan text-brand-cyan">
                <Star className="w-4 h-4 fill-brand-cyan animate-pulse" /> Unlock Core Memory Card
              </h2>
              <p className="text-[10px] text-slate-400 mb-4 leading-relaxed uppercase">
                &quot;{completeOpen.title}&quot; becomes a permanent star memory. Attach details:
              </p>

              <form onSubmit={handleSaveCoreMemory} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Memory Photo URL (Optional)</label>
                  <input
                    type="text"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/memories/trip1.jpg"
                    className="w-full py-2.5 px-3 glass-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Completion Date</label>
                    <input
                      type="date"
                      required
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      className="w-full py-2.5 px-3 glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Experience Rating</label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(parseInt(e.target.value))}
                      className="w-full py-2.5 px-3 glass-input text-xs bg-slate-900"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (Fabulous)</option>
                      <option value={4}>⭐⭐⭐⭐ (Lovely)</option>
                      <option value={3}>⭐⭐⭐ (Okay)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Personal Journal Notes</label>
                  <textarea
                    required
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Describe how it felt to finalize this dream..."
                    rows={3}
                    className="w-full py-2.5 px-3 glass-input text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-3 bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-fuchsia text-white rounded-xl text-xs font-semibold hover:opacity-90 transition duration-300 shadow cursor-pointer flex justify-center items-center"
                >
                  {formLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Spawn Star Memory Star'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}

// Subcomponent: Sandbox Card Widget
interface SandboxCardWidgetProps {
  card: SandboxCard;
  onMove: (card: SandboxCard, newStatus: SandboxCard['status']) => void;
  onDelete: (id: string) => void;
  stage: SandboxCard['status'];
}

const SandboxCardWidget: React.FC<SandboxCardWidgetProps> = ({ card, onMove, onDelete, stage }) => {
  return (
    <motion.div
      layoutId={card.id}
      className="p-4 bg-slate-900/60 border border-white/5 rounded-xl flex flex-col justify-between space-y-3 relative group"
    >
      <div>
        <div className="flex justify-between items-start">
          <span className="text-[9px] uppercase tracking-wider font-semibold font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded">
            {card.category}
          </span>
          <button
            onClick={() => onDelete(card.id)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/5 rounded transition text-slate-500 hover:text-rose-400 cursor-pointer"
            title="Delete Card"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <h3 className="text-xs font-bold text-slate-200 mt-2">{card.title}</h3>
        <p className="text-[10px] text-slate-400 mt-1 font-light leading-relaxed">
          {card.metadata.notes}
        </p>
      </div>

      {card.metadata.photoUrl && (
        <div className="rounded-lg overflow-hidden border border-white/5 max-h-24">
          <img src={card.metadata.photoUrl} alt={card.title} className="w-full object-cover h-20" />
        </div>
      )}

      {/* Transition triggers */}
      <div className="flex justify-between items-center pt-2 border-t border-white/5">
        {stage !== 'wishlist' ? (
          <button
            onClick={() => onMove(card, stage === 'right_now' ? 'wishlist' : 'right_now')}
            className="flex items-center gap-0.5 text-[9px] text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            <ArrowLeft className="w-2.5 h-2.5" /> Back
          </button>
        ) : (
          <div />
        )}

        {stage !== 'core_memories' ? (
          <button
            onClick={() => onMove(card, stage === 'wishlist' ? 'right_now' : 'core_memories')}
            className={`flex items-center gap-0.5 text-[9px] cursor-pointer font-semibold ${
              stage === 'wishlist' ? 'text-brand-violet hover:text-brand-fuchsia' : 'text-brand-cyan hover:text-glow-cyan'
            }`}
          >
            {stage === 'wishlist' ? 'Activate' : 'Complete Star'} <ArrowRight className="w-2.5 h-2.5" />
          </button>
        ) : (
          <span className="flex items-center gap-0.5 text-[9px] text-brand-gold font-mono uppercase tracking-wider font-semibold">
            <Heart className="w-2.5 h-2.5 fill-brand-gold" /> Locked Star
          </span>
        )}
      </div>
    </motion.div>
  );
};
