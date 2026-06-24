/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Trophy, Star, Heart, Zap, Timer,
  ArrowLeft, Crown, RotateCcw, Sparkles, Type,
  MousePointerClick, Grid3X3
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import Navbar from '@/components/ui/Navbar';
import { GameScore } from '@/types';

// ─── Game Definitions ─────────────────────────────────────────
const GAMES = [
  {
    id: 'emoji-match',
    name: 'Emoji Match',
    emoji: '💕',
    desc: 'Flip cards and find matching pairs!',
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
    icon: Grid3X3,
  },
  {
    id: 'love-trivia',
    name: 'Love Trivia',
    emoji: '💬',
    desc: '10 fun relationship trivia questions!',
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-600',
    icon: Star,
  },
  {
    id: 'word-chain',
    name: 'Word Chain',
    emoji: '🔤',
    desc: 'Chain love words in 60 seconds!',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-teal-500',
    icon: Type,
  },
  {
    id: 'tap-dash',
    name: 'Tap Dash',
    emoji: '⚡',
    desc: 'Catch falling hearts before they vanish!',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-500',
    icon: MousePointerClick,
  },
] as const;

type GameId = typeof GAMES[number]['id'];

// ─── Trivia Questions ─────────────────────────────────────────
const TRIVIA_QUESTIONS = [
  { q: 'What percentage of couples say "I love you" within the first 3 months?', options: ['25%', '39%', '55%', '70%'], answer: 1 },
  { q: 'What is the most common anniversary gift for the first year?', options: ['Gold', 'Paper', 'Silver', 'Crystal'], answer: 1 },
  { q: 'How many muscles does a kiss use?', options: ['12', '34', '56', '2'], answer: 1 },
  { q: 'In which country is it tradition to break plates at weddings?', options: ['Italy', 'Greece', 'Japan', 'Brazil'], answer: 1 },
  { q: 'What hormone is released when you hug someone for 20+ seconds?', options: ['Dopamine', 'Cortisol', 'Oxytocin', 'Serotonin'], answer: 2 },
  { q: 'What is the average length of a first date?', options: ['30 min', '1 hour', '1.5 hours', '3 hours'], answer: 2 },
  { q: 'Which flower symbolizes love and passion?', options: ['Daisy', 'Tulip', 'Red Rose', 'Sunflower'], answer: 2 },
  { q: 'How many times does the average person fall in love in their lifetime?', options: ['1', '3', '7', '12'], answer: 1 },
  { q: 'What day of the week do most couples go on their first date?', options: ['Monday', 'Friday', 'Saturday', 'Sunday'], answer: 2 },
  { q: 'In a study, what % of couples met through mutual friends?', options: ['15%', '22%', '30%', '40%'], answer: 1 },
  { q: 'What does "XOXO" stand for?', options: ['Love & Hugs', 'Kisses & Hugs', 'Hearts & Smiles', 'Hugs & Kisses'], answer: 1 },
  { q: 'Which ancient civilization invented Valentine\'s Day celebrations?', options: ['Egyptian', 'Roman', 'Greek', 'Chinese'], answer: 1 },
  { q: 'What color rose means "friendship"?', options: ['Red', 'White', 'Yellow', 'Pink'], answer: 2 },
  { q: 'On average, how long does a crush last?', options: ['1 month', '4 months', '1 year', '3 years'], answer: 1 },
  { q: 'What is the love language most people identify as their primary?', options: ['Gifts', 'Words of Affirmation', 'Quality Time', 'Physical Touch'], answer: 2 },
];

// ─── Love Words for Word Chain ────────────────────────────────
const LOVE_WORDS = new Set([
  'love','lovely','lover','adore','adoring','affection','angel','babe','baby','beauty',
  'beloved','bliss','blissful','bond','bouquet','butterfly','candlelight','care','caring',
  'charm','charming','cherish','close','closeness','comfort','companion','connection',
  'crush','cuddle','cute','darling','date','dating','dear','dearest','desire','devoted',
  'devotion','dream','dreamy','embrace','emotion','enchant','endear','eternal','faith',
  'faithful','fancy','fate','feel','feeling','flame','flirt','flutter','fond','fondness',
  'forever','gift','glow','grace','grateful','happiness','happy','harmony','heart',
  'heartbeat','heaven','hug','hugs','intimacy','intimate','joy','joyful','kind','kindness',
  'kiss','kisses','laugh','laughter','life','light','longing','magic','magical','mate',
  'memory','miracle','miss','moon','moonlight','need','nurture','paradise','partner',
  'passion','passionate','peace','perfect','petal','pleasure','precious','promise',
  'pure','radiant','rainbow','romance','romantic','rose','serenade','sincere','smile',
  'smitten','soft','soul','soulmate','spark','special','star','starlight','stars',
  'sunset','sweet','sweetheart','tender','tenderness','together','touch','treasure',
  'true','trust','valentine','warmth','wedding','wish','wonder','wonderful','yearn','yours',
  'sugar','sunrise','snuggle','sparkle','spring','summer','song','sail','shine','shelter',
  'safe','seek','share','show','story','strong','sunshine','support','surprise','serene',
  'sunny','sea','sky','scenic','simple','style','snap','swift','super','scenic',
  'talent','taste','tease','thrill','time','travel','team','trinket','turn','twinkle',
  'unity','unique','uplift','understand',
  'vow','vibrant','vision','vital','voice','venture',
  'warm','wave','wealth','wild','win','wine','winter','wise','world','wrap',
  'yearning','youthful',
  'zeal','zen','zest',
  'night','nature','new','noble','near','nest','nice','neat',
  'elegant','engage','enjoy','escape','evening','ever','evolve','explore','extra',
  'gaze','gentle','giggle','glad','gleam','glimpse','golden','good','gorgeous',
]);

// ─── Emoji pairs for memory game ──────────────────────────────
const EMOJI_POOL = ['💕','💖','💗','💓','💝','💘','🥰','😍','💑','💐','🌹','💍','🦋','⭐','🌙','🔥','🎀','🍫','🧸','🎠'];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════
// EMOJI MATCH GAME
// ═══════════════════════════════════════════════════════════════
function EmojiMatchGame({ onScore }: { onScore: (score: number) => void }) {
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const lockRef = useRef(false);

  const initGame = useCallback(() => {
    const picked = shuffleArray(EMOJI_POOL).slice(0, 8);
    const pairs = shuffleArray([...picked, ...picked]).map((emoji, i) => ({
      id: i, emoji, flipped: false, matched: false,
    }));
    setCards(pairs);
    setSelected([]);
    setMatches(0);
    setMoves(0);
    setStartTime(Date.now());
    setGameOver(false);
    setFinalScore(0);
    lockRef.current = false;
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  const handleFlip = (idx: number) => {
    if (lockRef.current || cards[idx].flipped || cards[idx].matched || gameOver) return;

    const next = [...cards];
    next[idx].flipped = true;
    setCards(next);

    const newSelected = [...selected, idx];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      lockRef.current = true;
      setMoves(m => m + 1);
      const [a, b] = newSelected;

      if (next[a].emoji === next[b].emoji) {
        setTimeout(() => {
          const matched = [...next];
          matched[a].matched = true;
          matched[b].matched = true;
          setCards(matched);
          setSelected([]);
          lockRef.current = false;

          const newMatches = matches + 1;
          setMatches(newMatches);

          if (newMatches === 8) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const timeBonus = Math.max(0, 120 - elapsed);
            const moveBonus = Math.max(0, 100 - (moves + 1) * 5);
            const score = 800 + timeBonus + moveBonus;
            setFinalScore(score);
            setGameOver(true);
            onScore(score);
          }
        }, 400);
      } else {
        setTimeout(() => {
          const reset = [...next];
          reset[a].flipped = false;
          reset[b].flipped = false;
          setCards(reset);
          setSelected([]);
          lockRef.current = false;
        }, 800);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>Pairs: {matches}/8</span>
        <span>Moves: {moves}</span>
        <button onClick={initGame} className="flex items-center gap-1 text-brand-cyan hover:underline cursor-pointer">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto">
        {cards.map((card, idx) => (
          <motion.button
            key={card.id}
            onClick={() => handleFlip(idx)}
            whileTap={{ scale: 0.9 }}
            className={`aspect-square rounded-xl text-2xl md:text-3xl flex items-center justify-center cursor-pointer transition-all duration-300 border
              ${card.matched ? 'bg-emerald-500/20 border-emerald-500/30 scale-95' :
                card.flipped ? 'bg-brand-violet/20 border-brand-violet/40' :
                'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
          >
            <AnimatePresence mode="wait">
              {card.flipped || card.matched ? (
                <motion.span
                  key="emoji"
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {card.emoji}
                </motion.span>
              ) : (
                <motion.span
                  key="back"
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-slate-600"
                >
                  ?
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center glass p-5 rounded-2xl border border-emerald-500/20"
          >
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-lg font-bold text-emerald-400">All Matched!</p>
            <p className="text-2xl font-black text-white mt-1">{finalScore} pts</p>
            <p className="text-[10px] text-slate-500 mt-1">{moves} moves</p>
            <button onClick={initGame} className="mt-3 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition">
              Play Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOVE TRIVIA GAME
// ═══════════════════════════════════════════════════════════════
function LoveTriviaGame({ onScore }: { onScore: (score: number) => void }) {
  const [questions, setQuestions] = useState<typeof TRIVIA_QUESTIONS>([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const initGame = useCallback(() => {
    setQuestions(shuffleArray(TRIVIA_QUESTIONS).slice(0, 10));
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setShowAnswer(false);
    setGameOver(false);
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  const handleAnswer = (idx: number) => {
    if (showAnswer || gameOver) return;
    setSelected(idx);
    setShowAnswer(true);
    const correct = idx === questions[current].answer;
    const newScore = correct ? score + 10 : score;
    if (correct) setScore(newScore);

    setTimeout(() => {
      if (current + 1 >= questions.length) {
        setGameOver(true);
        onScore(newScore);
      } else {
        setCurrent(c => c + 1);
        setSelected(null);
        setShowAnswer(false);
      }
    }, 1500);
  };

  if (questions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>Question {current + 1}/{questions.length}</span>
        <span className="text-brand-violet font-bold">{score} pts</span>
        <button onClick={initGame} className="flex items-center gap-1 text-brand-cyan hover:underline cursor-pointer">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-violet to-brand-fuchsia rounded-full"
          animate={{ width: `${((current) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {!gameOver ? (
        <div>
          <p className="text-sm font-semibold text-white mb-4 leading-relaxed">{questions[current].q}</p>
          <div className="grid grid-cols-1 gap-2">
            {questions[current].options.map((opt, idx) => {
              const isCorrect = idx === questions[current].answer;
              const isSelected = selected === idx;
              return (
                <motion.button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  whileTap={{ scale: 0.97 }}
                  className={`text-left p-3 rounded-xl text-sm cursor-pointer transition-all border
                    ${showAnswer
                      ? isCorrect
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : isSelected
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-white/3 border-white/5 text-slate-500'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200'
                    }`}
                >
                  <span className="font-mono text-xs text-slate-500 mr-2">{String.fromCharCode(65 + idx)}.</span>
                  {opt}
                  {showAnswer && isCorrect && <span className="ml-2">✓</span>}
                  {showAnswer && isSelected && !isCorrect && <span className="ml-2">✗</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center glass p-5 rounded-2xl border border-brand-violet/20"
        >
          <div className="text-4xl mb-2">{score >= 80 ? '🏆' : score >= 50 ? '⭐' : '💪'}</div>
          <p className="text-lg font-bold text-brand-violet">Trivia Complete!</p>
          <p className="text-2xl font-black text-white mt-1">{score}/{questions.length * 10} pts</p>
          <p className="text-[10px] text-slate-500 mt-1">{score / 10} correct answers</p>
          <button onClick={initGame} className="mt-3 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition">
            Play Again
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WORD CHAIN GAME
// ═══════════════════════════════════════════════════════════════
function WordChainGame({ onScore }: { onScore: (score: number) => void }) {
  const [input, setInput] = useState('');
  const [chain, setChain] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const startGame = () => {
    setChain([]);
    setInput('');
    setTimeLeft(60);
    setGameStarted(true);
    setGameOver(false);
    setError('');
    inputRef.current?.focus();
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (timeLeft === 0 && gameStarted && !gameOver) {
      setGameOver(true);
      onScore(chain.length * 10);
    }
  }, [timeLeft, gameStarted, gameOver, chain.length, onScore]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleSubmit = () => {
    if (!input.trim() || gameOver) return;
    const word = input.trim().toLowerCase();

    // Must be a valid love word
    if (!LOVE_WORDS.has(word)) {
      setError(`"${word}" is not in the word list!`);
      return;
    }

    // Can't repeat words
    if (chain.includes(word)) {
      setError(`"${word}" already used!`);
      return;
    }

    // Must start with last letter of previous word
    if (chain.length > 0) {
      const lastWord = chain[chain.length - 1];
      const lastLetter = lastWord[lastWord.length - 1];
      if (word[0] !== lastLetter) {
        setError(`Must start with "${lastLetter.toUpperCase()}"!`);
        return;
      }
    }

    setChain(prev => [...prev, word]);
    setInput('');
    setError('');
  };

  return (
    <div className="space-y-4">
      {!gameStarted ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🔤</div>
          <p className="text-sm text-slate-300 mb-2">Type love-related words in a chain!</p>
          <p className="text-[10px] text-slate-500 mb-4">Each word must start with the last letter of the previous word.</p>
          <button onClick={startGame} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold text-sm rounded-xl cursor-pointer hover:opacity-90 transition">
            Start Game (60s)
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="text-brand-cyan font-bold">{chain.length} words</span>
            <span className={`font-mono font-bold text-lg ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
              {timeLeft}s
            </span>
            <span className="text-brand-violet font-bold">{chain.length * 10} pts</span>
          </div>

          {/* Timer bar */}
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${timeLeft <= 10 ? 'bg-rose-500' : 'bg-gradient-to-r from-brand-cyan to-brand-violet'}`}
              animate={{ width: `${(timeLeft / 60) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {!gameOver ? (
            <div>
              {chain.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-slate-500 mb-1">Next word must start with:</p>
                  <span className="text-2xl font-black text-brand-cyan">
                    {chain[chain.length - 1][chain[chain.length - 1].length - 1].toUpperCase()}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder={chain.length === 0 ? 'Type any love word...' : `Word starting with "${chain[chain.length - 1][chain[chain.length - 1].length - 1].toUpperCase()}"...`}
                  className="flex-1 glass-input px-3 py-2.5 text-sm"
                  autoComplete="off"
                />
                <button onClick={handleSubmit} className="px-4 py-2 bg-brand-cyan text-slate-950 font-bold text-xs rounded-xl cursor-pointer hover:opacity-90 transition">
                  Add
                </button>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-rose-400 mt-1">
                  {error}
                </motion.p>
              )}

              {/* Word chain display */}
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-24 overflow-y-auto">
                {chain.map((word, idx) => (
                  <span key={idx} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 font-mono">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center glass p-5 rounded-2xl border border-brand-cyan/20"
            >
              <div className="text-4xl mb-2">{chain.length >= 15 ? '🏆' : chain.length >= 8 ? '⭐' : '💪'}</div>
              <p className="text-lg font-bold text-brand-cyan">Time&apos;s Up!</p>
              <p className="text-2xl font-black text-white mt-1">{chain.length * 10} pts</p>
              <p className="text-[10px] text-slate-500 mt-1">{chain.length} words chained</p>
              <button onClick={startGame} className="mt-3 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition">
                Play Again
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAP DASH GAME
// ═══════════════════════════════════════════════════════════════
function TapDashGame({ onScore }: { onScore: (score: number) => void }) {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targets, setTargets] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const [missed, setMissed] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const spawnRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const nextIdRef = useRef(0);
  const scoreRef = useRef(0);

  const HEART_EMOJIS = ['💖', '💗', '💕', '💓', '❤️', '💘', '💝', '🩷'];

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(30);
    setTargets([]);
    setMissed(0);
    nextIdRef.current = 0;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          clearInterval(spawnRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    let spawnInterval = 1200;
    const spawnTarget = () => {
      const id = nextIdRef.current++;
      const x = 5 + Math.random() * 80; // % position
      const y = 5 + Math.random() * 75;
      const emoji = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];
      setTargets(prev => [...prev, { id, x, y, emoji }]);

      // Remove after 1.8s if not clicked
      setTimeout(() => {
        setTargets(prev => {
          const found = prev.find(t => t.id === id);
          if (found) {
            setMissed(m => m + 1);
            return prev.filter(t => t.id !== id);
          }
          return prev;
        });
      }, 1800);

      // Speed up over time
      spawnInterval = Math.max(400, spawnInterval - 15);
      clearInterval(spawnRef.current);
      spawnRef.current = setInterval(spawnTarget, spawnInterval);
    };

    spawnRef.current = setInterval(spawnTarget, spawnInterval);
    // First target immediately
    setTimeout(spawnTarget, 300);
  };

  useEffect(() => {
    if (timeLeft === 0 && gameStarted && !gameOver) {
      setGameOver(true);
      setTargets([]);
      onScore(scoreRef.current);
    }
  }, [timeLeft, gameStarted, gameOver, onScore]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, []);

  const handleCatch = (id: number) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    const newScore = score + 10;
    setScore(newScore);
    scoreRef.current = newScore;
  };

  return (
    <div className="space-y-4">
      {!gameStarted ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">⚡</div>
          <p className="text-sm text-slate-300 mb-2">Tap the hearts before they vanish!</p>
          <p className="text-[10px] text-slate-500 mb-4">You have 30 seconds. Hearts appear faster over time!</p>
          <button onClick={startGame} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-xl cursor-pointer hover:opacity-90 transition">
            Start Dash!
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="text-emerald-400 font-bold">Caught: {score / 10}</span>
            <span className={`font-mono font-bold text-lg ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
              {timeLeft}s
            </span>
            <span className="text-rose-400 font-bold">Missed: {missed}</span>
          </div>

          {!gameOver ? (
            <div
              ref={areaRef}
              className="relative w-full rounded-2xl border border-white/10 bg-slate-900/50 overflow-hidden"
              style={{ height: '320px' }}
            >
              {/* Grid pattern */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 30px), repeating-linear-gradient(90deg, #fff, #fff 1px, transparent 1px, transparent 30px)' }} />

              <AnimatePresence>
                {targets.map(target => (
                  <motion.button
                    key={target.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    onClick={() => handleCatch(target.id)}
                    className="absolute text-3xl cursor-pointer hover:scale-125 transition-transform z-10"
                    style={{ left: `${target.x}%`, top: `${target.y}%` }}
                    whileTap={{ scale: 0.5 }}
                  >
                    {target.emoji}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center glass p-5 rounded-2xl border border-amber-500/20"
            >
              <div className="text-4xl mb-2">{score >= 200 ? '🏆' : score >= 100 ? '⚡' : '💪'}</div>
              <p className="text-lg font-bold text-amber-400">Dash Complete!</p>
              <p className="text-2xl font-black text-white mt-1">{score} pts</p>
              <p className="text-[10px] text-slate-500 mt-1">{score / 10} hearts caught, {missed} missed</p>
              <button onClick={startGame} className="mt-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition">
                Play Again
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN GAMES PAGE
// ═══════════════════════════════════════════════════════════════
export default function GamesPage() {
  const router = useRouter();
  const { user, profile, partnerProfile, loading } = useApp();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [scores, setScores] = useState<GameScore[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (!profile?.couple_id) router.push('/onboarding');
    }
  }, [user, profile, loading, router]);

  const loadScores = useCallback(async () => {
    if (!profile?.couple_id) return;
    const data = await db.getGameScores(profile.couple_id);
    setScores(data);
  }, [profile?.couple_id]);

  useEffect(() => { loadScores(); }, [loadScores]);

  const handleScore = async (gameName: string, score: number) => {
    if (!profile?.couple_id || !profile?.id) return;
    setSaving(true);
    try {
      await db.saveGameScore(profile.couple_id, profile.id, gameName, score);
      await loadScores();
    } catch (err) {
      console.error('Failed to save score:', err);
    } finally {
      setSaving(false);
    }
  };

  const getMyHighScore = (gameName: string) => {
    const myScores = scores.filter(s => s.game_name === gameName && s.user_id === profile?.id);
    return myScores.length > 0 ? Math.max(...myScores.map(s => s.score)) : 0;
  };

  const getPartnerHighScore = (gameName: string) => {
    const partnerScores = scores.filter(s => s.game_name === gameName && s.user_id === partnerProfile?.id);
    return partnerScores.length > 0 ? Math.max(...partnerScores.map(s => s.score)) : 0;
  };

  const getRecentScores = (gameName: string) => {
    return scores.filter(s => s.game_name === gameName).slice(0, 5);
  };

  const activeGameDef = GAMES.find(g => g.id === activeGame);

  if (loading || !profile) return null;

  return (
    <div className="min-h-screen cinematic-bg text-slate-100 flex flex-col pb-32 relative">
      {/* Nebula orbs */}
      <div className="fixed top-0 left-1/3 w-[500px] h-[500px] bg-emerald-500/5 rounded-full filter blur-[120px] pointer-events-none animate-nebula" />
      <div className="fixed bottom-10 right-0 w-[400px] h-[400px] bg-brand-violet/5 rounded-full filter blur-[100px] pointer-events-none animate-nebula-2" />

      <main className="max-w-5xl mx-auto w-full px-4 md:px-6 pt-8 space-y-6 relative z-10">

        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-1">
            {activeGame && (
              <button onClick={() => setActiveGame(null)} className="p-2 glass rounded-xl border border-white/10 hover:bg-white/10 cursor-pointer transition">
                <ArrowLeft className="w-4 h-4 text-slate-300" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-widest bg-gradient-to-r from-emerald-400 via-brand-cyan to-brand-violet bg-clip-text text-transparent flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 text-emerald-400" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.6))' }} />
                {activeGameDef ? activeGameDef.name : 'MINI GAMES'}
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                {activeGameDef ? activeGameDef.desc : 'Play together, compete for high scores!'}
              </p>
            </div>
          </div>
        </motion.section>

        {/* Game Selection or Active Game */}
        <AnimatePresence mode="wait">
          {!activeGame ? (
            <motion.div
              key="game-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Game Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GAMES.map((game, idx) => {
                  const myHigh = getMyHighScore(game.id);
                  const partnerHigh = getPartnerHighScore(game.id);
                  const Icon = game.icon;
                  return (
                    <motion.button
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => setActiveGame(game.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="glass p-5 rounded-2xl border border-white/5 hover:border-white/15 text-left cursor-pointer group relative overflow-hidden transition-all"
                    >
                      {/* Background gradient on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `radial-gradient(circle at 30% 50%, ${game.color}15 0%, transparent 70%)` }} />

                      <div className="relative z-10 flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}
                          style={{ boxShadow: `0 4px 20px ${game.color}40` }}>
                          {game.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-white">{game.name}</h3>
                            <Icon className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <p className="text-[10px] text-slate-400 mb-3">{game.desc}</p>

                          {/* Score comparison */}
                          <div className="flex gap-3 text-[10px]">
                            <div className="flex items-center gap-1">
                              <Crown className="w-3 h-3 text-brand-gold" />
                              <span className="text-slate-400">You:</span>
                              <span className="font-bold text-white">{myHigh}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-brand-fuchsia" />
                              <span className="text-slate-400">{partnerProfile?.username || 'Partner'}:</span>
                              <span className="font-bold text-white">{partnerHigh}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Leaderboard */}
              {scores.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass p-5 rounded-2xl border border-white/5"
                >
                  <h2 className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-brand-gold" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.8))' }} />
                    Recent Scores
                  </h2>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {scores.slice(0, 10).map((s, idx) => (
                      <div key={s.id} className="flex items-center gap-3 p-2 bg-white/3 rounded-lg border border-white/5">
                        <span className="text-xs font-mono text-slate-500 w-5 text-center">{idx + 1}</span>
                        <span className="text-sm">
                          {GAMES.find(g => g.id === s.game_name)?.emoji || '🎮'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white block truncate">
                            {s.user_id === profile?.id ? profile?.username : (partnerProfile?.username || 'Partner')}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {GAMES.find(g => g.id === s.game_name)?.name || s.game_name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-brand-gold">{s.score}</span>
                        <span className="text-[9px] text-slate-600">
                          {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="active-game"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Active Game Container */}
              <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                {/* Header glow */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r"
                  style={{ backgroundImage: `linear-gradient(to right, ${activeGameDef?.color || '#fff'}, transparent)` }} />

                {/* Score comparison bar */}
                <div className="flex flex-wrap justify-between items-center gap-2 mb-5 text-xs">
                  <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg border border-white/5">
                    <Crown className="w-3 h-3 text-brand-gold" />
                    <span className="text-slate-400">Your best:</span>
                    <span className="font-bold text-white">{getMyHighScore(activeGame)}</span>
                  </div>
                  {saving && (
                    <span className="text-[10px] text-emerald-400 animate-pulse flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Saving...
                    </span>
                  )}
                  <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg border border-white/5">
                    <Heart className="w-3 h-3 text-brand-fuchsia" />
                    <span className="text-slate-400">{partnerProfile?.username || 'Partner'}:</span>
                    <span className="font-bold text-white">{getPartnerHighScore(activeGame)}</span>
                  </div>
                </div>

                {/* Game component */}
                {activeGame === 'emoji-match' && <EmojiMatchGame onScore={(s) => handleScore('emoji-match', s)} />}
                {activeGame === 'love-trivia' && <LoveTriviaGame onScore={(s) => handleScore('love-trivia', s)} />}
                {activeGame === 'word-chain' && <WordChainGame onScore={(s) => handleScore('word-chain', s)} />}
                {activeGame === 'tap-dash' && <TapDashGame onScore={(s) => handleScore('tap-dash', s)} />}
              </div>

              {/* Recent scores for this game */}
              {getRecentScores(activeGame).length > 0 && (
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <h3 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                    <Timer className="w-3 h-3" /> Recent Scores
                  </h3>
                  <div className="space-y-1.5">
                    {getRecentScores(activeGame).map((s, idx) => (
                      <div key={s.id} className="flex items-center justify-between text-xs p-2 bg-white/3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-600 font-mono w-4">{idx + 1}.</span>
                          <span className={`font-semibold ${s.user_id === profile?.id ? 'text-brand-cyan' : 'text-brand-fuchsia'}`}>
                            {s.user_id === profile?.id ? 'You' : (partnerProfile?.username || 'Partner')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">{s.score} pts</span>
                          <span className="text-[9px] text-slate-600">
                            {new Date(s.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <Navbar />
    </div>
  );
}
