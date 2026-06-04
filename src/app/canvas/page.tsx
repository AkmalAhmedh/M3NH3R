'use client';

import React, {
  useRef, useState, useEffect, useCallback
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit2, Eraser, RefreshCw, Pin, Image as ImageIcon,
  MousePointer, Sparkles, X, ZoomIn, ZoomOut, Undo2,
  Square, Circle, Type, Minus, Download, Users
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/ui/Navbar';

// ─── Types ───────────────────────────────────────────────────
type ToolType = 'pencil' | 'eraser' | 'line' | 'rect' | 'circle' | 'text';

interface Point { x: number; y: number; }

interface Stroke {
  id: string;
  tool: ToolType;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  text?: string;
  userId?: string;
}

interface PartnerState {
  userId: string;
  username: string;
  cursorX: number;
  cursorY: number;
  isDrawing: boolean;
  color: string;
}

// ─── Constants ───────────────────────────────────────────────
const CANVAS_W = 4000;
const CANVAS_H = 4000;

const PRESET_COLORS = [
  '#8b5cf6', '#d946ef', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6366f1', '#ffffff', '#94a3b8',
  '#f43f5e', '#84cc16', '#14b8a6', '#a855f7',
];

// ─── Utility ─────────────────────────────────────────────────
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Main Component ──────────────────────────────────────────
export default function CanvasPage() {
  const router = useRouter();
  const { user, profile, loading } = useApp();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // live preview overlay
  const containerRef = useRef<HTMLDivElement>(null);

  // Tool state
  const [tool, setTool] = useState<ToolType>('pencil');
  const [color, setColor] = useState('#8b5cf6');
  const [lineWidth, setLineWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [zoom, setZoom] = useState(1);

  // Stroke state — keep ref in sync for realtime callbacks
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const undoStackRef = useRef<Stroke[][]>([[]]);
  const undoIndexRef = useRef(0);

  // Drawing state
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastBroadcastMs = useRef(0);

  // UI State
  const [partnerState, setPartnerState] = useState<PartnerState | null>(null);
  const [partnerActive, setPartnerActive] = useState(false);
  const partnerTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [bgUrl, setBgUrl] = useState('');
  const [bgInputUrl, setBgInputUrl] = useState('');
  const [bgSelectorOpen, setBgSelectorOpen] = useState(false);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const [drawingName, setDrawingName] = useState('Our Masterpiece');
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Auth Guard ────────────────────────────────────────────
  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (!profile?.couple_id) router.push('/onboarding');
    }
  }, [user, profile, loading, router]);

  // ─── Background Image Loader ───────────────────────────────
  useEffect(() => {
    if (!bgUrl) { setBgImage(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = bgUrl;
    img.onload = () => setBgImage(img);
    img.onerror = () => setBgImage(null);
  }, [bgUrl]);

  // ─── Canvas Renderer ───────────────────────────────────────
  const renderCanvas = useCallback((strokesToRender: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background
    if (bgImage) {
      const ratio = Math.max(CANVAS_W / bgImage.width, CANVAS_H / bgImage.height);
      const w = bgImage.width * ratio;
      const h = bgImage.height * ratio;
      ctx.drawImage(bgImage, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
    }

    // Draw all strokes
    strokesToRender.forEach(stroke => drawStroke(ctx, stroke));
  }, [bgImage]);

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (!stroke.points || stroke.points.length === 0) return;
    ctx.save();
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const p = stroke.points;

    if (stroke.tool === 'pencil' || stroke.tool === 'eraser') {
      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      }
      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0].x, p[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length - 1; i++) {
          const mx = (p[i].x + p[i + 1].x) / 2;
          const my = (p[i].y + p[i + 1].y) / 2;
          ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
        }
        ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
        ctx.stroke();
      }
    } else if (stroke.tool === 'line') {
      if (p.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
        ctx.stroke();
      }
    } else if (stroke.tool === 'rect') {
      if (p.length >= 2) {
        ctx.beginPath();
        ctx.strokeRect(p[0].x, p[0].y, p[p.length - 1].x - p[0].x, p[p.length - 1].y - p[0].y);
      }
    } else if (stroke.tool === 'circle') {
      if (p.length >= 2) {
        const dx = p[p.length - 1].x - p[0].x;
        const dy = p[p.length - 1].y - p[0].y;
        const r = Math.sqrt(dx * dx + dy * dy) / 2;
        const cx = (p[0].x + p[p.length - 1].x) / 2;
        const cy = (p[0].y + p[p.length - 1].y) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (stroke.tool === 'text' && stroke.text) {
      ctx.font = `${stroke.width * 4}px Outfit, sans-serif`;
      ctx.fillText(stroke.text, p[0].x, p[0].y);
    }

    ctx.restore();
  }

  // Overlay renderer for live shape preview
  function renderOverlay(previewStroke: Stroke | null) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (previewStroke) drawStroke(ctx, previewStroke);
  }

  useEffect(() => {
    renderCanvas(strokesRef.current);
  }, [strokes, renderCanvas]);

  // ─── Realtime Channel ──────────────────────────────────────
  useEffect(() => {
    if (!profile?.couple_id) return;

    const channel = supabase.channel(`canvas-v2-${profile.couple_id}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        setPartnerState(payload as PartnerState);
        setPartnerActive(true);
        clearTimeout(partnerTimeoutRef.current);
        partnerTimeoutRef.current = setTimeout(() => setPartnerActive(false), 3000);
      })
      .on('broadcast', { event: 'stroke_update' }, ({ payload }) => {
        const incoming = payload.stroke as Stroke;
        setStrokes(prev => {
          const idx = prev.findIndex(s => s.id === incoming.id);
          let next: Stroke[];
          if (idx >= 0) {
            next = [...prev];
            next[idx] = incoming;
          } else {
            next = [...prev, incoming];
          }
          strokesRef.current = next;
          return next;
        });
      })
      .on('broadcast', { event: 'stroke_commit' }, ({ payload }) => {
        const incoming = payload.stroke as Stroke;
        setStrokes(prev => {
          const idx = prev.findIndex(s => s.id === incoming.id);
          let next: Stroke[];
          if (idx >= 0) {
            next = [...prev];
            next[idx] = incoming;
          } else {
            next = [...prev, incoming];
          }
          strokesRef.current = next;
          return next;
        });
      })
      .on('broadcast', { event: 'clear' }, () => {
        setStrokes([]);
        strokesRef.current = [];
        setBgUrl('');
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      clearTimeout(partnerTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [profile?.couple_id]);

  // Center scroll on mount
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      el.scrollLeft = (CANVAS_W * zoom - el.clientWidth) / 2;
      el.scrollTop = (CANVAS_H * zoom - el.clientHeight) / 2;
    }
  }, [zoom]);

  // ─── Coordinate Helpers ───────────────────────────────────
  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  // ─── Pointer Handlers ─────────────────────────────────────
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === 'text') return; // handled by click
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getCanvasCoords(e);
    startPosRef.current = pos;

    const newStroke: Stroke = {
      id: genId(),
      tool,
      points: [pos],
      color,
      width: lineWidth,
      opacity,
      userId: profile?.id,
    };
    currentStrokeRef.current = newStroke;

    setStrokes(prev => {
      const next = [...prev, newStroke];
      strokesRef.current = next;
      return next;
    });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!profile) return;
    const pos = getCanvasCoords(e);
    const now = Date.now();
    const channel = channelRef.current;

    // Broadcast cursor every 50ms
    if (now - lastBroadcastMs.current > 50 && channel) {
      channel.send({
        type: 'broadcast', event: 'cursor',
        payload: {
          userId: profile.id, username: profile.username,
          cursorX: pos.x, cursorY: pos.y,
          isDrawing: isDrawingRef.current, color,
        }
      });
      lastBroadcastMs.current = now;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    if (tool === 'pencil' || tool === 'eraser') {
      // Freehand — append point
      const updated: Stroke = {
        ...currentStrokeRef.current,
        points: [...currentStrokeRef.current.points, pos],
      };
      currentStrokeRef.current = updated;
      setStrokes(prev => {
        const idx = prev.findIndex(s => s.id === updated.id);
        const next = idx >= 0 ? [...prev] : [...prev, updated];
        if (idx >= 0) next[idx] = updated;
        strokesRef.current = next;
        return next;
      });

      // Broadcast stroke update throttled
      if (now - lastBroadcastMs.current > 30 && channel) {
        channel.send({
          type: 'broadcast', event: 'stroke_update',
          payload: { stroke: updated }
        });
      }
    } else {
      // Shape tools — update endpoint only, show in overlay
      const preview: Stroke = {
        ...currentStrokeRef.current,
        points: [startPosRef.current, pos],
      };
      currentStrokeRef.current = preview;
      renderOverlay(preview);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDrawingRef.current = false;

    const finalStroke = currentStrokeRef.current;
    renderOverlay(null); // clear overlay

    // For shapes, commit the final stroke to the main strokes list
    if (tool !== 'pencil' && tool !== 'eraser') {
      setStrokes(prev => {
        const idx = prev.findIndex(s => s.id === finalStroke.id);
        const next = idx >= 0 ? [...prev] : [...prev, finalStroke];
        if (idx >= 0) next[idx] = finalStroke;
        strokesRef.current = next;
        return next;
      });
    }

    // Broadcast final committed stroke
    channelRef.current?.send({
      type: 'broadcast', event: 'stroke_commit',
      payload: { stroke: finalStroke }
    });

    // Save undo snapshot
    const snapshot = [...strokesRef.current];
    undoStackRef.current = undoStackRef.current.slice(0, undoIndexRef.current + 1);
    undoStackRef.current.push(snapshot);
    undoIndexRef.current = undoStackRef.current.length - 1;

    currentStrokeRef.current = null;
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== 'text') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pos = {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
    setTextPos(pos);
    setShowTextInput(true);
  }

  function commitText() {
    if (!textInput.trim() || !textPos) return;
    const stroke: Stroke = {
      id: genId(), tool: 'text',
      points: [textPos], color, width: lineWidth, opacity,
      text: textInput, userId: profile?.id,
    };
    setStrokes(prev => {
      const next = [...prev, stroke];
      strokesRef.current = next;
      return next;
    });
    channelRef.current?.send({
      type: 'broadcast', event: 'stroke_commit',
      payload: { stroke }
    });
    setTextInput('');
    setShowTextInput(false);
    setTextPos(null);
  }

  // ─── Undo ─────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (undoIndexRef.current <= 0) return;
    undoIndexRef.current -= 1;
    const prev = undoStackRef.current[undoIndexRef.current];
    setStrokes(prev);
    strokesRef.current = prev;
    renderCanvas(prev);
  }, [renderCanvas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') handleUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  // ─── Clear ────────────────────────────────────────────────
  function handleClear() {
    setStrokes([]);
    strokesRef.current = [];
    setBgUrl('');
    channelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
  }

  // ─── Download ─────────────────────────────────────────────
  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${drawingName || 'canvas'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // ─── Pin to Refrigerator ──────────────────────────────────
  async function handlePinDrawing() {
    const canvas = canvasRef.current;
    if (!canvas || !profile?.couple_id || !profile?.id) return;
    setSavingDrawing(true);
    try {
      const imgDataUrl = canvas.toDataURL('image/png');
      await db.saveDrawing(profile.couple_id, profile.id, drawingName, strokes, imgDataUrl, true);
      await supabase.from('notifications').insert({
        couple_id: profile.couple_id,
        recipient_id: partnerState?.userId || profile.id,
        sender_id: profile.id,
        type: 'doodle',
        message: `${profile.username} pinned "${drawingName}" to the Refrigerator Door! 🎨`,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDrawing(false);
    }
  }

  // ─── Zoom ─────────────────────────────────────────────────
  function changeZoom(delta: number) {
    setZoom(prev => Math.min(3, Math.max(0.25, +(prev + delta).toFixed(2))));
  }

  // ─── Cursor style ─────────────────────────────────────────
  const cursorStyle: React.CSSProperties = {
    cursor: tool === 'eraser' ? 'cell'
      : tool === 'text' ? 'text'
      : 'crosshair',
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 pb-28 flex flex-col">
      {/* Ambient glow */}
      <div className="fixed top-0 right-1/4 w-[500px] h-[500px] bg-brand-violet/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-10 w-[400px] h-[400px] bg-brand-cyan/4 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Header ── */}
      <header className="w-full px-6 pt-8 pb-4 flex flex-wrap items-center justify-between gap-3 z-10 max-w-[95vw] mx-auto">
        <div>
          <h1 className="text-2xl font-black tracking-widest bg-gradient-to-r from-brand-violet via-brand-fuchsia to-brand-cyan bg-clip-text text-transparent flex items-center gap-2">
            ✏️ LIVE CANVAS
            {partnerActive && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1 text-[10px] font-semibold text-brand-cyan glass px-2 py-1 rounded-full border border-brand-cyan/30"
              >
                <span className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse" />
                {partnerState?.username || 'Partner'} drawing
              </motion.span>
            )}
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
            Real-time collaborative canvas — draw together
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 glass rounded-xl px-3 py-2 border border-white/5">
            <button onClick={() => changeZoom(-0.1)} className="p-1 hover:text-white text-slate-400 transition cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="text-[10px] font-mono text-slate-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => changeZoom(0.1)} className="p-1 hover:text-white text-slate-400 transition cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
          </div>

          <button onClick={handleUndo} className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-3 py-2 rounded-xl cursor-pointer text-slate-300 border border-white/5">
            <Undo2 className="w-3.5 h-3.5 text-brand-violet" /> Undo
          </button>
          <button onClick={() => setBgSelectorOpen(true)} className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-3 py-2 rounded-xl cursor-pointer text-slate-300 border border-white/5">
            <ImageIcon className="w-3.5 h-3.5 text-brand-cyan" /> Backdrop
          </button>
          <button onClick={handleClear} className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-3 py-2 rounded-xl cursor-pointer text-slate-300 border border-white/5">
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" /> Clear
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs glass hover:bg-white/10 transition px-3 py-2 rounded-xl cursor-pointer text-slate-300 border border-white/5">
            <Download className="w-3.5 h-3.5 text-brand-gold" /> Save
          </button>
        </div>
      </header>

      {/* ── Main Area ── */}
      <div className="flex-1 flex gap-4 px-4 max-w-[95vw] mx-auto w-full min-h-0">
        {/* Left Toolbar */}
        <aside className="glass rounded-2xl border border-white/5 p-4 flex flex-col gap-4 w-14 md:w-44 shrink-0 shadow-lg">

          {/* Tools */}
          <div>
            <span className="hidden md:block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">Tools</span>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { t: 'pencil', icon: Edit2, label: 'Draw' },
                { t: 'eraser', icon: Eraser, label: 'Erase' },
                { t: 'line', icon: Minus, label: 'Line' },
                { t: 'rect', icon: Square, label: 'Rect' },
                { t: 'circle', icon: Circle, label: 'Circle' },
                { t: 'text', icon: Type, label: 'Text' },
              ] as const).map(({ t, icon: Icon, label }) => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  title={label}
                  className={`p-2 rounded-xl cursor-pointer transition flex flex-col items-center gap-0.5 text-[8px] font-semibold
                    ${tool === t ? 'bg-brand-violet/30 text-brand-violet border border-brand-violet/40' : 'bg-white/4 hover:bg-white/8 text-slate-400 border border-transparent'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:block">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/8" />

          {/* Color Palette */}
          <div>
            <span className="hidden md:block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">Colors</span>
            <div className="grid grid-cols-4 gap-1">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { setColor(c); if (tool === 'eraser') setTool('pencil'); }}
                  className={`w-7 h-7 rounded-lg cursor-pointer transition-all border-2
                    ${color === c ? 'scale-110 border-white shadow-lg' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 10px ${c}` : 'none' }}
                />
              ))}
            </div>
            {/* Custom picker */}
            <div className="mt-2 relative w-full h-8 rounded-lg overflow-hidden border border-white/10">
              <input
                type="color"
                value={color}
                onChange={e => { setColor(e.target.value); if (tool === 'eraser') setTool('pencil'); }}
                className="absolute -top-1 -left-1 w-[110%] h-[110%] cursor-pointer opacity-0"
              />
              <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 pointer-events-none" style={{ background: color + '40' }}>
                🎨 custom
              </div>
            </div>
          </div>

          <div className="h-px bg-white/8" />

          {/* Size */}
          <div>
            <span className="hidden md:block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">Size {lineWidth}px</span>
            <input
              type="range" min={1} max={60} value={lineWidth}
              onChange={e => setLineWidth(+e.target.value)}
              className="w-full h-1 rounded-full appearance-none cursor-pointer accent-brand-violet"
            />
          </div>

          {/* Opacity */}
          <div>
            <span className="hidden md:block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">Opacity {Math.round(opacity * 100)}%</span>
            <input
              type="range" min={0.05} max={1} step={0.05} value={opacity}
              onChange={e => setOpacity(+e.target.value)}
              className="w-full h-1 rounded-full appearance-none cursor-pointer accent-brand-cyan"
            />
          </div>

          <div className="h-px bg-white/8" />

          {/* Partner indicator */}
          <div className="text-[9px] text-slate-500 text-center hidden md:block">
            <Users className="w-3.5 h-3.5 mx-auto mb-1" />
            {partnerActive
              ? <span className="text-brand-cyan">{partnerState?.username} online</span>
              : 'Waiting for partner'}
          </div>
        </aside>

        {/* Canvas viewport */}
        <section
          ref={containerRef}
          className="flex-1 glass rounded-2xl border border-white/5 overflow-auto relative bg-[#050810] shadow-inner shadow-black/80"
        >
          <div
            style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
            className="relative"
          >
            {/* Main drawing canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={handleCanvasClick}
              style={{
                ...cursorStyle,
                width: CANVAS_W * zoom,
                height: CANVAS_H * zoom,
                imageRendering: zoom > 1 ? 'pixelated' : 'auto',
              }}
              className="touch-none block absolute inset-0"
            />

            {/* Shape preview overlay */}
            <canvas
              ref={overlayRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{
                width: CANVAS_W * zoom,
                height: CANVAS_H * zoom,
                pointerEvents: 'none',
              }}
              className="absolute inset-0"
            />

            {/* Partner cursor */}
            {partnerState && partnerActive && (
              <div
                className="absolute pointer-events-none z-20 transition-all duration-75"
                style={{
                  left: partnerState.cursorX * zoom,
                  top: partnerState.cursorY * zoom,
                }}
              >
                <MousePointer
                  className="w-5 h-5"
                  style={{ color: partnerState.color || '#06b6d4', filter: `drop-shadow(0 0 6px ${partnerState.color || '#06b6d4'})` }}
                />
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded shadow mt-0.5 block"
                  style={{ background: partnerState.color || '#06b6d4', color: '#fff' }}
                >
                  {partnerState.username}
                </span>
              </div>
            )}

            {/* Text input floating */}
            {showTextInput && textPos && (
              <div
                className="absolute z-30 flex items-center gap-1"
                style={{ left: textPos.x * zoom, top: textPos.y * zoom }}
              >
                <input
                  autoFocus
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setShowTextInput(false); setTextPos(null); } }}
                  placeholder="Type here…"
                  className="glass-input px-2 py-1 text-sm rounded-lg w-48 text-white"
                  style={{ fontSize: Math.max(12, lineWidth * 4 * zoom), color }}
                />
                <button onClick={commitText} className="glass p-1 rounded cursor-pointer text-emerald-400 text-xs">✓</button>
                <button onClick={() => { setShowTextInput(false); setTextPos(null); }} className="glass p-1 rounded cursor-pointer text-rose-400 text-xs">✕</button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="max-w-[95vw] mx-auto w-full px-4 mt-4 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={drawingName}
            onChange={e => setDrawingName(e.target.value)}
            className="glass-input px-3 py-1.5 text-xs w-40"
            placeholder="Name this artwork"
          />
          <button
            onClick={handlePinDrawing}
            disabled={savingDrawing}
            className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-brand-violet to-brand-fuchsia text-white hover:opacity-90 transition px-4 py-2 rounded-xl cursor-pointer shadow-lg shadow-brand-violet/20 disabled:opacity-50"
          >
            <Pin className="w-3.5 h-3.5" />
            {savingDrawing ? 'Pinning…' : 'Pin to Refrigerator'}
          </button>
        </div>

        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-xs text-emerald-400 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 animate-bounce" />
              Pinned! Check the Refrigerator Door on Dashboard.
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

      {/* ── Backdrop modal ── */}
      <AnimatePresence>
        {bgSelectorOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-intense rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-2xl relative"
            >
              <button onClick={() => setBgSelectorOpen(false)} className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-bold text-brand-cyan mb-4 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Photo Graffiti Backdrop
              </h2>
              <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                Paste a public image URL to use as canvas background — then draw doodles over it!
              </p>
              <div className="space-y-3">
                <input
                  type="text" value={bgInputUrl}
                  onChange={e => setBgInputUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full glass-input px-3 py-2 text-xs"
                />
                <button
                  onClick={() => { if (bgInputUrl) { setBgUrl(bgInputUrl); setBgSelectorOpen(false); } }}
                  className="w-full py-2 bg-brand-cyan hover:opacity-90 transition rounded-lg text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  Apply Backdrop
                </button>
                {bgUrl && (
                  <button
                    onClick={() => { setBgUrl(''); setBgImage(null); setBgSelectorOpen(false); }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 transition rounded-lg text-xs text-rose-400 cursor-pointer"
                  >
                    Remove Backdrop
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar />
    </div>
  );
}
