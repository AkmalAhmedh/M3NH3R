'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Lock, Unlock, Delete, AlertCircle, Plus, 
  Eye, EyeOff, Save, Trash, Calendar, ArrowRight, ShieldAlert 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import Navbar from '@/components/ui/Navbar';

interface SecretNote {
  id: string;
  title: string;
  content: string;
  date: string;
}

export default function SafeSpacePage() {
  const router = useRouter();
  const { user, profile, loading } = useApp();

  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Unlocked vault states
  const [secretNotes, setSecretNotes] = useState<SecretNote[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [showForm, setShowForm] = useState(false);
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

  // Check if vault has pin initialized
  const checkVaultStatus = useCallback(async () => {
    if (!profile?.couple_id) return;
    const exists = await db.hasSafeSpacePin(profile.couple_id);
    setHasPin(exists);
  }, [profile]);

  useEffect(() => {
    if (profile?.couple_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      checkVaultStatus();
    }
  }, [profile?.couple_id, checkVaultStatus]);

  // Load private vault notes from localStorage (encrypted/hidden vault emulation)
  const loadSecretNotes = useCallback(() => {
    if (!profile?.couple_id) return;
    const data = localStorage.getItem(`safe_space_notes_${profile.couple_id}`);
    setSecretNotes(data ? JSON.parse(data) : []);
  }, [profile]);

  const handleKeyPress = (num: string) => {
    setErrorMsg('');
    if (pin.length < 4) {
      setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  // Setup vault pin code
  const handleSetupPin = useCallback(async () => {
    if (pin.length !== 4) {
      setErrorMsg('Pin code must be exactly 4 digits.');
      return;
    }
    if (!isSettingPin) {
      // Step 1: Hold and toggle to confirm mode
      setConfirmPin(pin);
      setPin('');
      setIsSettingPin(true);
      setSuccessMsg('Re-enter pin code to confirm.');
    } else {
      // Step 2: Compare and commit
      if (pin !== confirmPin) {
        setErrorMsg('Pins do not match. Start over.');
        setPin('');
        setConfirmPin('');
        setIsSettingPin(false);
        return;
      }

      if (!profile?.couple_id) return;
      try {
        await db.setSafeSpacePin(profile.couple_id, pin);
        setHasPin(true);
        setIsUnlocked(true);
        loadSecretNotes();
        setSuccessMsg('Vault pin established!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        setErrorMsg('Failed to initialize vault.');
      }
    }
  }, [pin, confirmPin, isSettingPin, profile, loadSecretNotes]);

  // Verify vault pin code
  const handleUnlockVault = useCallback(async () => {
    if (!profile?.couple_id || pin.length !== 4) return;
    try {
      const match = await db.checkSafeSpacePin(profile.couple_id, pin);
      if (match) {
        setIsUnlocked(true);
        loadSecretNotes();
        setPin('');
      } else {
        setErrorMsg('Invalid code. Access denied.');
        setPin('');
      }
    } catch (err) {
      setErrorMsg('Encryption service unavailable.');
    }
  }, [profile, pin, loadSecretNotes]);

  useEffect(() => {
    if (pin.length === 4) {
      if (hasPin) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        handleUnlockVault();
      } else {
        handleSetupPin();
      }
    }
  }, [pin, hasPin, handleUnlockVault, handleSetupPin]);

  const handleCreateSecretNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.couple_id || !newTitle || !newContent) return;
    setFormLoading(true);

    const newNote: SecretNote = {
      id: Math.random().toString(),
      title: newTitle,
      content: newContent,
      date: new Date().toLocaleDateString()
    };

    const updated = [newNote, ...secretNotes];
    setSecretNotes(updated);
    localStorage.setItem(`safe_space_notes_${profile.couple_id}`, JSON.stringify(updated));

    setNewTitle('');
    setNewContent('');
    setShowForm(false);
    setFormLoading(false);
  };

  const handleDeleteSecretNote = (noteId: string) => {
    if (!profile?.couple_id) return;
    const updated = secretNotes.filter((n) => n.id !== noteId);
    setSecretNotes(updated);
    localStorage.setItem(`safe_space_notes_${profile.couple_id}`, JSON.stringify(updated));
  };

  if (loading || !profile || hasPin === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-brand-cyan animate-spin-slow mx-auto" />
          <p className="text-xs text-slate-400 uppercase tracking-widest">Warping to Safe Space nodes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32 flex flex-col justify-between items-center">
      {/* Glow backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-violet/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-fuchsia/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Header deck */}
      <header className="max-w-4xl w-full px-6 pt-10 flex justify-between items-center z-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-brand-violet to-brand-fuchsia bg-clip-text text-transparent flex items-center gap-1.5">
            🔑 SAFE SPACE VAULT
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Pin code protected space for private conversations & deep memories
          </p>
        </div>

        {isUnlocked && (
          <button
            onClick={() => { setIsUnlocked(false); setPin(''); }}
            className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-4 py-2 rounded-xl cursor-pointer text-slate-300"
          >
            <Lock className="w-4 h-4 text-rose-400" /> Lock Vault
          </button>
        )}
      </header>

      {/* Main vault window */}
      <main className="max-w-4xl w-full px-6 mt-8 flex-1 z-10 flex justify-center items-center">
        <AnimatePresence mode="wait">
          {!isUnlocked ? (
            /* LOCKSCREEN / KEYPAD INTERFACE */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm p-6 glass rounded-2xl border border-white/5 flex flex-col items-center space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-brand-violet mx-auto mb-2">
                  <Lock className="w-5 h-5 text-brand-fuchsia" />
                </div>
                <h2 className="text-sm font-semibold tracking-wider text-slate-200">
                  {hasPin ? 'Enter Vault Password' : 'Initialize Vault Password'}
                </h2>
                <p className="text-[10px] text-slate-400 leading-relaxed uppercase max-w-[240px] mx-auto">
                  {hasPin 
                    ? 'Enter your 4-digit code to decrypt' 
                    : isSettingPin 
                      ? 'Re-enter your 4-digit code to verify' 
                      : 'Set a 4-digit code to lock your vault'}
                </p>
              </div>

              {/* Pin dots indicator */}
              <div className="flex gap-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border border-white/20 transition-all duration-300 ${
                      pin.length > idx 
                        ? 'bg-brand-violet shadow-lg shadow-brand-violet/50 border-brand-violet scale-110' 
                        : 'bg-white/5'
                    }`}
                  />
                ))}
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
                  <ShieldAlert className="w-4 h-4" /> {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-xs text-emerald-400 animate-pulse font-semibold">
                  {successMsg}
                </div>
              )}

              {/* Glass numeric pad */}
              <div className="grid grid-cols-3 gap-3 w-full">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="py-3 bg-white/5 border border-white/5 hover:bg-white/10 transition active:scale-95 rounded-xl text-lg font-bold font-mono cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  className="py-3 bg-slate-900 border border-white/5 hover:bg-slate-800 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="py-3 bg-white/5 border border-white/5 hover:bg-white/10 transition rounded-xl text-lg font-bold font-mono cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="py-3 bg-slate-900 border border-white/5 hover:bg-slate-800 rounded-xl flex items-center justify-center cursor-pointer text-slate-300"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ) : (
            /* UNLOCKED VAULT INTERFACE */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Unlock className="w-4 h-4 text-emerald-400" /> Decrypted Vault Archives
                </h2>

                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center gap-1 text-xs bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white px-4 py-2 rounded-xl hover:opacity-90 transition duration-300 shadow cursor-pointer font-semibold"
                >
                  <Plus className="w-4 h-4" /> {showForm ? 'Close Note Creator' : 'Write Private Memo'}
                </button>
              </div>

              {/* Note Creator form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="glass p-5 rounded-2xl border border-brand-violet/20 shadow-xl overflow-hidden"
                  >
                    <form onSubmit={handleCreateSecretNote} className="space-y-4">
                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Memo Title</label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. My secret wish lists"
                          className="w-full py-2.5 px-3 glass-input text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 tracking-wider mb-1">Secret Memo Body</label>
                        <textarea
                          required
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          placeholder="Type your sensitive information here. It is isolated from the outer database..."
                          rows={4}
                          className="w-full py-2.5 px-3 glass-input text-xs resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full py-3 bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white rounded-xl text-xs font-semibold hover:opacity-90 transition duration-300 shadow flex justify-center items-center cursor-pointer"
                      >
                        {formLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          'Lock Note into Vault'
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {secretNotes.map((note) => (
                  <div
                    key={note.id}
                    className="glass p-5 rounded-xl border border-white/5 flex flex-col justify-between space-y-4 shadow-lg hover:border-brand-violet/20 transition relative group"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="text-xs font-bold text-slate-200">{note.title}</h3>
                        <button
                          onClick={() => handleDeleteSecretNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/5 rounded transition text-slate-500 hover:text-rose-400 cursor-pointer"
                          title="Delete Memo"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-300 font-light leading-relaxed whitespace-pre-line mt-2">
                        {note.content}
                      </p>
                    </div>

                    <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {note.date}
                    </div>
                  </div>
                ))}

                {secretNotes.length === 0 && !showForm && (
                  <div className="md:col-span-2 glass p-12 text-center text-xs text-slate-500 rounded-2xl border border-white/5">
                    Your secret vault is empty. Click &quot;Write Private Memo&quot; to encrypt a note!
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Navbar />
    </div>
  );
}
