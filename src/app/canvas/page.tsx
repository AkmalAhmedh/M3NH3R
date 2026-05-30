'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Edit2, Eraser, RefreshCw, Pin, Image as ImageIcon, 
  MousePointer, Sparkles, AlertCircle, Save, X 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/ui/Navbar';

interface Line {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface PartnerCursor {
  userId: string;
  username: string;
  x: number;
  y: number;
}

export default function CanvasPage() {
  const router = useRouter();
  const { user, profile, loading, isDemo } = useApp();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#8b5cf6'); // Violet
  const [lineWidth, setLineWidth] = useState(5);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  
  // Photo graffiti background
  const [bgUrl, setBgUrl] = useState('');
  const [bgInputUrl, setBgInputUrl] = useState('');
  const [bgSelectorOpen, setBgSelectorOpen] = useState(false);

  // Drawing paths history
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);

  // Real-time Partner cursor coordinates
  const [partnerCursor, setPartnerCursor] = useState<PartnerCursor | null>(null);
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [drawingName, setDrawingName] = useState('Our Masterpiece');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!profile?.couple_id) {
        router.push('/onboarding');
      }
    }
  }, [user, profile, loading, router]);

  // Handle redraw of canvas whenever lines or bgUrl changes
  useEffect(() => {
    drawCanvas();
  }, [lines, bgUrl]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If background image set, draw it first
    if (bgUrl) {
      const img = new Image();
      img.src = bgUrl;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw centered and cover scale
        const ratio = Math.max(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        
        // Then draw lines over it
        drawLines(ctx);
      };
    } else {
      drawLines(ctx);
    }
  };

  const drawLines = (ctx: CanvasRenderingContext2D) => {
    lines.forEach((line) => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) {
        ctx.moveTo(line.points[i - 1].x, line.points[i - 1].y);
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      ctx.stroke();
    });
  };

  // Adjust canvas size to parent container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight || 500;
      drawCanvas();
    };

    window.addEventListener('resize', handleResize);
    // Call initial sizing
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef.current, bgUrl]);

  // Real-time Collaboration Channel using Supabase Broadcast
  useEffect(() => {
    if (isDemo || !profile?.couple_id) return;

    const channel = supabase.channel(`canvas-${profile.couple_id}`, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
        setPartnerCursor(payload);
      })
      .on('broadcast', { event: 'draw_stroke' }, ({ payload }) => {
        setLines(payload.lines);
      })
      .on('broadcast', { event: 'clear_canvas' }, () => {
        setLines([]);
        setBgUrl('');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.couple_id, isDemo]);

  // Mouse / Pointer Event Listeners
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    const newLine: Line = {
      points: [coords],
      color: tool === 'eraser' ? '#090d16' : color, // Erase with background canvas color
      width: lineWidth
    };
    setCurrentLine(newLine);
    setLines((prev) => [...prev, newLine]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!profile) return;
    const coords = getCoordinates(e);

    // 1. Broadcast cursor position to partner in real-time
    if (!isDemo) {
      const channel = supabase.channel(`canvas-${profile.couple_id}`);
      channel.send({
        type: 'broadcast',
        event: 'cursor_move',
        payload: {
          userId: profile.id,
          username: profile.username,
          x: coords.x,
          y: coords.y
        }
      });
    }

    // 2. Perform drawing
    if (!isDrawing || !currentLine) return;

    const updatedPoints = [...currentLine.points, coords];
    const updatedLine = { ...currentLine, points: updatedPoints };
    setCurrentLine(updatedLine);

    const updatedLines = [...lines];
    updatedLines[updatedLines.length - 1] = updatedLine;
    setLines(updatedLines);

    // 3. Broadcast stroke database in real-time
    if (!isDemo) {
      const channel = supabase.channel(`canvas-${profile.couple_id}`);
      channel.send({
        type: 'broadcast',
        event: 'draw_stroke',
        payload: { lines: updatedLines }
      });
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    setCurrentLine(null);
  };

  const handleClearCanvas = () => {
    if (!profile) return;
    setLines([]);
    setBgUrl('');

    if (!isDemo) {
      const channel = supabase.channel(`canvas-${profile.couple_id}`);
      channel.send({
        type: 'broadcast',
        event: 'clear_canvas',
        payload: {}
      });
    }
  };

  const handleApplyBackground = () => {
    if (bgInputUrl) {
      setBgUrl(bgInputUrl);
      setBgSelectorOpen(false);
    }
  };

  const handlePinDrawing = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !profile || !profile.couple_id || !profile.id) return;
    setSavingDrawing(true);
    setSaveSuccess(false);

    try {
      const imgDataUrl = canvas.toDataURL('image/png');
      
      // Save drawing as pinned doodle to display on Refrigerator Door
      await db.saveDrawing(profile.couple_id, profile.id, drawingName, lines, imgDataUrl, true);
      
      // Also notify partner
      if (!isDemo) {
        await supabase.from('notifications').insert({
          couple_id: profile.couple_id,
          recipient_id: partnerCursor?.userId || profile.id, // Fallback to issuer if partner offline
          sender_id: profile.id,
          type: 'doodle',
          message: `${profile.username} pinned a brand new doodle to the Refrigerator Door!`
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDrawing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-32 flex flex-col items-center">
      
      {/* Header Deck */}
      <header className="max-w-5xl w-full px-6 pt-10 flex justify-between items-center z-10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-wider bg-gradient-to-r from-brand-violet to-brand-fuchsia bg-clip-text text-transparent flex items-center gap-1.5">
            LIVE CANVAS
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Real-time drawing graffiti & refrigerator pins
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setBgSelectorOpen(!bgSelectorOpen)}
            className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-4 py-2 rounded-xl cursor-pointer text-slate-300"
          >
            <ImageIcon className="w-4 h-4 text-brand-cyan" /> Photo Graffiti
          </button>
          
          <button
            onClick={handleClearCanvas}
            className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-4 py-2 rounded-xl cursor-pointer text-slate-300"
          >
            <RefreshCw className="w-4 h-4 text-rose-400" /> Clear
          </button>
        </div>
      </header>

      {/* Main Canvas Canvas Section */}
      <main className="max-w-5xl w-full px-6 mt-8 flex flex-col md:flex-row gap-6 z-10 flex-1 min-h-[500px]">
        {/* Left Toolbar */}
        <section className="glass p-5 rounded-2xl border border-white/5 flex flex-row md:flex-col justify-around md:justify-start gap-4 md:w-44">
          
          {/* Brush Colors */}
          <div className="space-y-2">
            <span className="hidden md:block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Palette</span>
            <div className="flex flex-wrap gap-2">
              {['#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#22c55e', '#ef4444', '#ffffff'].map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setTool('pencil'); }}
                  className={`w-6 h-6 rounded-full cursor-pointer transition border border-white/10 ${color === c && tool === 'pencil' ? 'scale-125 border-white ring-2 ring-brand-violet/30' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="w-px md:w-full h-auto md:h-px bg-white/10" />

          {/* Tools Selector */}
          <div className="space-y-2">
            <span className="hidden md:block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Tools</span>
            <div className="flex gap-2">
              <button
                onClick={() => setTool('pencil')}
                className={`p-2 rounded-lg cursor-pointer transition ${tool === 'pencil' ? 'bg-brand-violet text-white' : 'bg-white/5 hover:bg-white/10'}`}
                title="Pencil Brush"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-lg cursor-pointer transition ${tool === 'eraser' ? 'bg-brand-violet text-white' : 'bg-white/5 hover:bg-white/10'}`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-px md:w-full h-auto md:h-px bg-white/10" />

          {/* Stroke Width */}
          <div className="space-y-2 flex-1 md:flex-none">
            <span className="hidden md:block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Thickness ({lineWidth}px)</span>
            <input
              type="range"
              min={2}
              max={25}
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-violet"
            />
          </div>

        </section>

        {/* Real Canvas Window */}
        <section ref={containerRef} className="flex-1 glass rounded-2xl border border-white/5 overflow-hidden relative bg-[#090d16] shadow-inner shadow-black/80 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="cursor-crosshair w-full h-full touch-none"
          />

          {/* Real-time Partner Live Cursor indicator */}
          {partnerCursor && (
            <div
              className="absolute pointer-events-none transition-all duration-75 flex flex-col items-center"
              style={{ left: partnerCursor.x, top: partnerCursor.y }}
            >
              <MousePointer className="w-4 h-4 text-brand-cyan fill-brand-cyan rotate-90" />
              <span className="text-[8px] bg-slate-900 border border-brand-cyan text-brand-cyan px-1.5 py-0.5 rounded shadow mt-1">
                {partnerCursor.username}
              </span>
            </div>
          )}
        </section>
      </main>

      {/* Canvas Controls Footer - Pinning Drawing */}
      <footer className="max-w-5xl w-full px-6 mt-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={drawingName}
            onChange={(e) => setDrawingName(e.target.value)}
            className="glass-input px-3 py-1.5 text-xs max-w-[160px]"
            placeholder="Name your artwork"
          />
          <button
            onClick={handlePinDrawing}
            disabled={savingDrawing}
            className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white hover:opacity-90 transition px-4 py-2 rounded-xl cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Pin className="w-4 h-4" /> {savingDrawing ? 'Pinning...' : 'Pin to Refrigerator'}
          </button>
        </div>

        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-emerald-400 flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4 animate-bounce" /> Artwork pinned successfully! Check Refrigerator Door.
          </motion.div>
        )}
      </footer>

      {/* Drawer selector: Photo Graffiti Image url */}
      <AnimatePresence>
        {bgSelectorOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm p-6 glass-intense rounded-2xl border border-white/10 shadow-2xl relative"
            >
              <button
                onClick={() => setBgSelectorOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-sm font-bold mb-4 flex items-center gap-1.5 text-glow-cyan text-brand-cyan">
                <ImageIcon className="w-4 h-4" /> Photo Graffiti Backdrop
              </h2>
              <p className="text-[10px] text-slate-400 mb-4 leading-relaxed uppercase">
                Paste an image URL below to set as canvas background and draw doodles over it:
              </p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={bgInputUrl}
                  onChange={(e) => setBgInputUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full py-2 px-3 glass-input text-xs"
                />

                <button
                  onClick={handleApplyBackground}
                  className="w-full py-2 bg-brand-cyan hover:opacity-90 transition rounded-lg text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  Apply Photo Backdrop
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}
