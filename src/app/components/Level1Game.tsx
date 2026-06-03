import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { LevelIntro } from './LevelIntro';

// ─── Canvas constants ────────────────────────────────────────────────────────
const CW = 760, CH = 460, WATER_Y = 430, PLAT_H = 40;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Plat { id: string; x: number; w: number; y: number; label: string; isStart?: boolean; isGoal?: boolean; }
interface Gap  { fromId: string; toId: string; a: number; b: number; c: number; tol: number; }
interface Inv  { length: number; count: number; }
type Phase    = 'pick_target' | 'pick_material' | 'building' | 'walking' | 'fail' | 'complete';
type FailKind = 'short' | 'long';
interface GS {
  phase: Phase; charPlatId: string; gapIdx: number | null;
  selLen: number | null; installedLen: number | null; inv: Inv[]; built: number[];
  buildProg: number; walkProg: number; failKind: FailKind | null; wrong: number;
}

// ─── Level data ───────────────────────────────────────────────────────────────
const PLATS: Plat[] = [
  { id: 'p1', x: 55,  w: 90, y: 355, label: 'START', isStart: true },
  { id: 'p2', x: 245, w: 85, y: 265, label: 'P-2'                  },
  { id: 'p3', x: 435, w: 85, y: 355, label: 'P-3'                  },
  { id: 'p4', x: 600, w: 92, y: 140, label: 'GOAL',  isGoal: true  },
];
const GAPS: Gap[] = [
  { fromId: 'p1', toId: 'p2', a: 3, b: 4, c: 5,  tol: 0.3 },
  { fromId: 'p2', toId: 'p3', a: 6, b: 8, c: 10, tol: 0.3 },
  { fromId: 'p3', toId: 'p4', a: 5, b: 12,c: 13, tol: 0.3 },
];
const INIT_INV: Inv[] = [{ length: 5, count: 1 }, { length: 10, count: 1 }, { length: 13, count: 1 }];

const getP = (id: string) => PLATS.find(p => p.id === id)!;
const anch  = (g: Gap) => { const f = getP(g.fromId), t = getP(g.toId); return { la: { x: f.x + f.w, y: f.y }, ra: { x: t.x, y: t.y } }; };

function matInfo(len: number) {
  const defs = [{ max: 6, icon: '🪵', prefix: 'WB' }, { max: 12, icon: '🔩', prefix: 'ST' }, { max: 20, icon: '⚙️', prefix: 'TR' }, { max: 99, icon: '🏗️', prefix: 'XT' }];
  const d = defs.find(m => len <= m.max) ?? defs[defs.length - 1];
  return { icon: d.icon, code: `${d.prefix}-${String(len).padStart(2,'0')}` };
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const c = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y);
  ctx.arcTo(x + w, y, x + w, y + c, c); ctx.lineTo(x + w, y + h - c);
  ctx.arcTo(x + w, y + h, x + w - c, y + h, c); ctx.lineTo(x + c, y + h);
  ctx.arcTo(x, y + h, x, y + h - c, c); ctx.lineTo(x, y + c);
  ctx.arcTo(x, y, x + c, y, c); ctx.closePath();
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.save(); ctx.font = 'bold 11px monospace';
  const tw = ctx.measureText(text).width, pw = tw + 10, ph = 18;
  ctx.fillStyle = 'rgba(2,8,20,0.92)';
  rrect(ctx, x - pw / 2, y - ph / 2, pw, ph, 4); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y); ctx.restore();
}

function drawBg(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#030c1b'; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = 'rgba(20,80,180,0.13)'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= CW; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
  for (let y = 0; y <= CH; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = 0.025; ctx.fillStyle = '#4db3ff';
  ctx.font = 'bold 72px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('? ? ?', CW / 2, CH / 2); ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, t: number) {
  const wg = ctx.createLinearGradient(0, WATER_Y, 0, CH);
  wg.addColorStop(0, 'rgba(0,55,110,0.85)'); wg.addColorStop(1, 'rgba(0,18,45,0.9)');
  ctx.fillStyle = wg; ctx.fillRect(0, WATER_Y, CW, CH - WATER_Y);
  ctx.strokeStyle = 'rgba(40,140,255,0.13)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(0, WATER_Y + 5 + i * 9);
    for (let x = 0; x <= CW; x += 14) ctx.lineTo(x, WATER_Y + 5 + i * 9 + Math.sin(x * 0.07 + t * 1.1 + i) * 2.5);
    ctx.stroke();
  }
}

function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, t: number, targets: string[], charPlatId: string) {
  const { x, y, w } = p;
  const isTarget = targets.includes(p.id);
  const isCurrent = p.id === charPlatId;
  ctx.save();
  // Goal glow
  if (p.isGoal) {
    const g = ctx.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, 65);
    g.addColorStop(0, 'rgba(0,230,118,0.16)'); g.addColorStop(1, 'rgba(0,230,118,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 35, y - 45, w + 70, 90);
  }
  // Target pulse outline
  if (isTarget) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    ctx.strokeStyle = `rgba(255,196,0,${0.35 + 0.45 * pulse})`;
    ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    rrect(ctx, x - 4, y - 4, w + 8, PLAT_H + 8, 6); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Column supports
  const edgeCol = p.isGoal ? '#00e676' : isCurrent ? '#4db3ff' : '#1e4a7a';
  ctx.fillStyle = edgeCol; ctx.globalAlpha = 0.22;
  ctx.fillRect(x + 8, y + PLAT_H, 5, CH - y - PLAT_H);
  ctx.fillRect(x + w - 13, y + PLAT_H, 5, CH - y - PLAT_H);
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.isGoal ? '#071a0e' : '#06111e';
  rrect(ctx, x, y, w, PLAT_H, 3); ctx.fill();
  ctx.fillStyle = edgeCol; ctx.fillRect(x, y, w, 4);
  ctx.strokeStyle = edgeCol; ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
  rrect(ctx, x, y, w, PLAT_H, 3); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = edgeCol;
  ctx.fillText(p.label, x + w / 2, y + PLAT_H / 2 + 1);
  ctx.restore();
}

type Pt = { x: number; y: number };

function beamLine(ctx: CanvasRenderingContext2D, la: Pt, end: Pt, main: string, hi: string) {
  const dx = end.x - la.x, dy = end.y - la.y;
  const len = Math.sqrt(dx*dx + dy*dy); if (len < 1) return;
  const ux = dx/len, uy = dy/len;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(la.x+1.5, la.y+1.5); ctx.lineTo(end.x+1.5, end.y+1.5); ctx.stroke();
  ctx.strokeStyle = main; ctx.lineWidth = 9; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(end.x, end.y); ctx.stroke();
  ctx.strokeStyle = hi; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(la.x, la.y - 1); ctx.lineTo(end.x, end.y - 1); ctx.stroke();
  if (len > 20) {
    const n = Math.max(2, Math.floor(len / 18));
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < n; i++) {
      const tt = i / n, px = la.x + dx*tt, py = la.y + dy*tt;
      ctx.beginPath(); ctx.moveTo(px + uy*5.5, py - ux*5.5); ctx.lineTo(px - uy*5.5, py + ux*5.5); ctx.stroke();
    }
  }
}

function drawBuiltBridge(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, c: number) {
  ctx.save();
  beamLine(ctx, la, ra, '#2d5a1b', '#4a8a2a');
  chip(ctx, `${c % 1 === 0 ? c : c.toFixed(1)}m ✓`, (la.x+ra.x)/2, (la.y+ra.y)/2 - 12, '#00e676');
  ctx.restore();
}

function drawExtBridge(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, instLen: number, correctC: number, prog: number) {
  const dx = ra.x-la.x, dy = ra.y-la.y;
  const cpx = Math.sqrt(dx*dx + dy*dy); if (cpx === 0) return;
  const ux = dx/cpx, uy = dy/cpx;
  const chosenPx = (instLen/correctC)*cpx;
  const curPx = chosenPx * prog; if (curPx < 1) return;
  const ex = la.x + ux*curPx, ey = la.y + uy*curPx;
  ctx.save();
  beamLine(ctx, la, {x: ex, y: ey}, '#a35200', '#d47000');
  if (prog < 1) {
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 13);
    g.addColorStop(0, 'rgba(255,196,0,0.9)'); g.addColorStop(1, 'rgba(255,196,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffc400'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawFailBridge(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, instLen: number, correctC: number, kind: FailKind, prog: number) {
  const dx = ra.x-la.x, dy = ra.y-la.y;
  const cpx = Math.sqrt(dx*dx + dy*dy); if (cpx === 0) return;
  const ux = dx/cpx, uy = dy/cpx;
  const chosenPx = (instLen/correctC)*cpx;
  ctx.save();
  if (kind === 'short') {
    const drop = prog * 50;
    const ex = la.x + ux*chosenPx, ey = la.y + uy*chosenPx + drop;
    beamLine(ctx, la, {x: ex, y: ey}, '#6b1c1c', '#8b2424');
    ctx.strokeStyle = 'rgba(239,68,68,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ra.x, ra.y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
  } else {
    const ex = la.x + ux*chosenPx, ey = la.y + uy*chosenPx;
    beamLine(ctx, la, ra, '#8a3d00', '#b45309');
    beamLine(ctx, ra, {x: ex, y: ey}, '#6b1c1c', '#ef4444');
    if (prog > 0.25) {
      ctx.fillStyle = '#fbbf24';
      for (let i = 0; i < 8; i++) {
        const ang = (i/8)*Math.PI*2 + prog;
        const sr = 9 + prog * 7;
        ctx.globalAlpha = Math.max(0, 1 - prog * 0.7);
        ctx.beginPath(); ctx.arc(ra.x + Math.cos(ang)*sr, ra.y + Math.sin(ang)*sr, 2.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawDims(ctx: CanvasRenderingContext2D, g: Gap, la: Pt, ra: Pt) {
  const corner = { x: ra.x, y: la.y };
  const vd = ra.y < la.y ? -1 : 1;
  ctx.save(); ctx.setLineDash([6,5]); ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(93,165,255,0.55)';
  ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(corner.x, corner.y); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,200,120,0.55)';
  ctx.beginPath(); ctx.moveTo(corner.x, corner.y); ctx.lineTo(ra.x, ra.y); ctx.stroke();
  ctx.setLineDash([]);
  const sq = 10;
  ctx.strokeStyle = 'rgba(148,163,184,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(corner.x - sq, corner.y); ctx.lineTo(corner.x - sq, corner.y + vd*sq); ctx.lineTo(corner.x, corner.y + vd*sq);
  ctx.stroke();
  chip(ctx, `a=${g.a}`, (la.x + corner.x)/2, la.y + (vd > 0 ? -12 : 16), '#5da5ff');
  chip(ctx, `b=${g.b}`, corner.x + 20, (corner.y + ra.y)/2, '#50c878');
  ctx.restore();
}

function drawReady(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, t: number) {
  const dx = ra.x-la.x, dy = ra.y-la.y;
  const len = Math.sqrt(dx*dx + dy*dy); if (len === 0) return;
  const ux = dx/len, uy = dy/len;
  const pulse = 0.5 + 0.5*Math.sin(t*4);
  ctx.save();
  const g = ctx.createRadialGradient(la.x, la.y, 0, la.x, la.y, 20);
  g.addColorStop(0, `rgba(255,196,0,${0.45 + 0.35*pulse})`); g.addColorStop(1, 'rgba(255,196,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(la.x, la.y, 20, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffc400'; ctx.beginPath(); ctx.arc(la.x, la.y, 5, 0, Math.PI*2); ctx.fill();
  const al = Math.min(len*0.22, 30);
  const ax = la.x + ux*al, ay = la.y + uy*al;
  ctx.strokeStyle = '#ffc400'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(ax, ay); ctx.stroke();
  const ang = Math.atan2(uy, ux), as2 = 7;
  ctx.fillStyle = '#ffc400'; ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - as2*Math.cos(ang-0.45), ay - as2*Math.sin(ang-0.45));
  ctx.lineTo(ax - as2*Math.cos(ang+0.45), ay - as2*Math.sin(ang+0.45));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawChar(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  ctx.save();
  const hR = 7, body = 14, leg = 12, hip = y - leg, shoulder = hip - body;
  ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x, shoulder - hR, hR, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.arc(x, shoulder - hR - 4, 9, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - 11, shoulder - hR - 4, 22, 4);
  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, shoulder); ctx.lineTo(x, hip); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7, shoulder + body*0.35); ctx.lineTo(x + 7, shoulder + body*0.35); ctx.stroke();
  if (frame === 0) {
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x - 5, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + 5, y); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + 6, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x - 4, y); ctx.stroke();
  }
  ctx.restore();
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { onBack?: () => void; onComplete?: (wrong: number) => void; }

const mkGs = (): GS => ({
  phase: 'pick_target', charPlatId: 'p1', gapIdx: null,
  selLen: null, installedLen: null, inv: INIT_INV.map(i => ({ ...i })),
  built: [], buildProg: 0, walkProg: 0, failKind: null, wrong: 0,
});

export function Level1Game({ onBack, onComplete }: Props) {
  const [showIntro, setShowIntro] = useState(true);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(true);
  const gsRef      = useRef<GS>(mkGs());
  const animTRef   = useRef(0);
  const walkFrameRef = useRef(0);
  const onCompleteCalledRef = useRef(false);
  const [gs, setGs] = useState<GS>(mkGs());

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { gsRef.current = gs; }, [gs]);

  // ─── Persistent RAF loop (smooth canvas, no state thrash) ─────────
  useEffect(() => {
    let id: number;
    const loop = (time: number) => {
      if (!mountedRef.current) return;
      animTRef.current = time / 1000;
      walkFrameRef.current = Math.floor(time / 140) % 2;
      const canvas = canvasRef.current; if (!canvas) { id = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d'); if (!ctx) { id = requestAnimationFrame(loop); return; }
      renderFrame(ctx, gsRef.current, animTRef.current, walkFrameRef.current);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  // ─── Build animation ──────────────────────────────────────────────
  useEffect(() => {
    if (gs.phase !== 'building') return;
    let id: number, cancelled = false;
    const start = performance.now();
    const run = (time: number) => {
      if (cancelled || !mountedRef.current) return;
      const prog = Math.min((time - start) / 1800, 1);
      setGs(prev => ({ ...prev, buildProg: prog }));
      if (prog < 1) { id = requestAnimationFrame(run); return; }
      setTimeout(() => {
        if (cancelled || !mountedRef.current) return;
        setGs(prev => {
          if (prev.gapIdx === null || prev.installedLen === null) return prev;
          const g = GAPS[prev.gapIdx];
          const diff = Math.abs(prev.installedLen - g.c);
          if (diff <= g.tol) return { ...prev, phase: 'walking', walkProg: 0 };
          const failKind: FailKind = prev.installedLen < g.c ? 'short' : 'long';
          return { ...prev, phase: 'fail', failKind, wrong: prev.wrong + 1 };
        });
      }, 150);
    };
    id = requestAnimationFrame(run);
    return () => { cancelled = true; cancelAnimationFrame(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase]);

  // ─── Fire onComplete after phase transitions to 'complete' ──────
  useEffect(() => {
    if (gs.phase === 'complete' && !onCompleteCalledRef.current) {
      onCompleteCalledRef.current = true;
      onComplete?.(gs.wrong);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase]);

  // ─── Auto-advance when only one reachable target ─────────────────
  useEffect(() => {
    if (gs.phase !== 'pick_target') return;
    const avail = GAPS.map((g, i) => ({ g, i })).filter(({ g, i }) => g.fromId === gs.charPlatId && !gs.built.includes(i));
    if (avail.length === 1) setGs(prev => ({ ...prev, phase: 'pick_material', gapIdx: avail[0].i, selLen: null }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase, gs.charPlatId, gs.built.length]);

  // ─── Walk animation ───────────────────────────────────────────────
  useEffect(() => {
    if (gs.phase !== 'walking') return;
    let id: number, cancelled = false;
    const start = performance.now();
    const run = (time: number) => {
      if (cancelled || !mountedRef.current) return;
      const prog = Math.min((time - start) / 2000, 1);
      setGs(prev => ({ ...prev, walkProg: prog }));
      if (prog < 1) { id = requestAnimationFrame(run); return; }
      setGs(prev => {
        if (prev.gapIdx === null) return prev;
        const g = GAPS[prev.gapIdx];
        const newBuilt = [...prev.built, prev.gapIdx];
        const newCharPlatId = g.toId;
        if (newCharPlatId === 'p4') {
          return { ...prev, phase: 'complete', charPlatId: newCharPlatId, built: newBuilt, walkProg: 1 };
        }
        const avail = GAPS.map((g2, i) => ({ g: g2, i })).filter(({ g: g2, i }) => g2.fromId === newCharPlatId && !newBuilt.includes(i));
        if (avail.length === 1) {
          return { ...prev, phase: 'pick_material', charPlatId: newCharPlatId, built: newBuilt, gapIdx: avail[0].i, selLen: null, installedLen: null, walkProg: 1 };
        }
        return { ...prev, phase: 'pick_target', charPlatId: newCharPlatId, built: newBuilt, gapIdx: null, selLen: null, installedLen: null, walkProg: 1 };
      });
    };
    id = requestAnimationFrame(run);
    return () => { cancelled = true; cancelAnimationFrame(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const reachable = GAPS.map((g, i) => ({ g, i })).filter(({ g, i }) => g.fromId === gs.charPlatId && !gs.built.includes(i)).map(({ g }) => g.toId);

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (gs.phase !== 'pick_target') return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CW / rect.width);
    const my = (e.clientY - rect.top) * (CH / rect.height);
    for (const platId of reachable) {
      const p = getP(platId);
      if (mx >= p.x && mx <= p.x + p.w && my >= p.y && my <= p.y + PLAT_H) {
        const gapIdx = GAPS.findIndex(g => g.fromId === gs.charPlatId && g.toId === platId && !gs.built.includes(GAPS.indexOf(g)));
        if (gapIdx >= 0) setGs(prev => ({ ...prev, phase: 'pick_material', gapIdx, selLen: null }));
        break;
      }
    }
  };

  const handleSelectMat = (len: number) => {
    if (gs.phase !== 'pick_material') return;
    setGs(prev => ({ ...prev, selLen: prev.selLen === len ? null : len }));
  };

  const handleBuild = () => {
    if (gs.phase !== 'pick_material' || gs.selLen === null || gs.gapIdx === null) return;
    const newInv = gs.inv.map(it => it.length === gs.selLen ? { ...it, count: it.count - 1 } : it).filter(it => it.count > 0);
    setGs(prev => ({ ...prev, inv: newInv, installedLen: prev.selLen, selLen: null, phase: 'building', buildProg: 0, failKind: null }));
  };

  const handleRetry = () => {
    if (gs.phase !== 'fail') return;
    const avail = GAPS.map((g, i) => ({ g, i })).filter(({ g, i }) => g.fromId === gs.charPlatId && !gs.built.includes(i));
    if (avail.length === 0) return;
    if (avail.length === 1) {
      setGs(prev => ({ ...prev, phase: 'pick_material', gapIdx: avail[0].i, installedLen: null, selLen: null }));
    } else {
      setGs(prev => ({ ...prev, phase: 'pick_target', gapIdx: null, installedLen: null, selLen: null }));
    }
  };

  const handleRestart = () => { onCompleteCalledRef.current = false; setGs(mkGs()); };

  // ─── Derived ──────────────────────────────────────────────────────
  const gap = gs.gapIdx !== null ? GAPS[gs.gapIdx] : null;
  const canBuild = gs.phase === 'pick_material' && gs.selLen !== null;
  const isBusy   = gs.phase === 'building';
  const isFail   = gs.phase === 'fail';
  const invEmpty = gs.phase === 'pick_material' && gs.inv.length === 0;


  // ─── JSX ─────────────────────────────────────────────────────────
  if (showIntro) return <LevelIntro levelId={1} onStart={() => setShowIntro(false)} />;

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: '#020b18' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(30,80,180,0.25)' }}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} style={{ color: '#4db3ff', fontSize: '1.1rem', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}>←</button>
          )}
          <span style={{ color: '#4db3ff', fontFamily: 'monospace', fontSize: '0.78rem' }}>LEVEL 01 · 数字探索 · 单向通关</span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: gs.wrong > 0 ? '#f87171' : '#4ade80', fontFamily: 'monospace', fontSize: '0.82rem' }}>✗ {gs.wrong}</span>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="rounded-full" style={{ width: 8, height: 8, background: gs.built.includes(i) ? '#00e676' : i === gs.gapIdx ? '#ffc400' : '#0d2a4a' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-2" style={{ minHeight: 220 }}>
          <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
            style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: 10, border: '1px solid rgba(20,80,180,0.3)', cursor: gs.phase === 'pick_target' ? 'pointer' : 'default' }}
          />
        </div>

        {/* Sidebar */}
        <div className="shrink-0 flex flex-col gap-3 p-3 overflow-y-auto" style={{ width: '100%', maxWidth: 300, minWidth: 252, background: 'rgba(0,0,0,0.38)', borderLeft: '1px solid rgba(20,80,180,0.2)' }}>
          {/* Warehouse header */}
          <div style={{ color: '#4db3ff', fontSize: '0.72rem', fontFamily: 'monospace', letterSpacing: 1 }}>■ 建材仓库 / MATERIAL WAREHOUSE</div>

          {/* Inventory */}
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {INIT_INV.map(({ length }) => {
              const current = gs.inv.find(it => it.length === length);
              const count = current?.count ?? 0;
              const mat = matInfo(length);
              const isSel = gs.selLen === length;
              const disabled = gs.phase !== 'pick_material' || count === 0;
              return (
                <button key={length} onClick={() => handleSelectMat(length)} disabled={disabled}
                  className="rounded-xl py-2 px-1 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                  style={{
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? (count === 0 ? 0.28 : 0.45) : 1,
                    background: isSel ? 'rgba(255,196,0,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${isSel ? '#ffc400' : 'rgba(20,80,180,0.35)'}`,
                    boxShadow: isSel ? '0 0 12px rgba(255,196,0,0.25)' : undefined,
                  }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{mat.icon}</span>
                  <span style={{ color: '#1e4a7a', fontSize: '0.5rem', fontFamily: 'monospace', letterSpacing: 0.5 }}>{mat.code}</span>
                  <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '1.05rem', lineHeight: 1.2 }}>{length}m</span>
                  <span style={{ color: count === 0 ? '#4b1c1c' : count === 1 ? '#f59e0b' : '#334155', fontSize: '0.6rem' }}>×{count}</span>
                </button>
              );
            })}
          </div>

          {/* Gap info */}
          {gap && gs.phase !== 'complete' && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(20,80,180,0.3)' }}>
              <p style={{ color: '#4db3ff', fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: 6 }}>◆ 当前跨度测量</p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: '1.4rem' }}>{gap.a}</p>
                  <p style={{ color: '#334155', fontSize: '0.65rem' }}>水平 a</p>
                </div>
                <div className="text-center">
                  <p style={{ color: '#86efac', fontFamily: 'monospace', fontSize: '1.4rem' }}>{gap.b}</p>
                  <p style={{ color: '#334155', fontSize: '0.65rem' }}>高差 b</p>
                </div>
                <div className="text-center">
                  <p style={{ color: '#fb923c', fontFamily: 'monospace', fontSize: '1.4rem' }}>?</p>
                  <p style={{ color: '#334155', fontSize: '0.65rem' }}>桥长 c</p>
                </div>
              </div>
              <p style={{ color: '#1e3a5f', fontSize: '0.65rem', fontFamily: 'monospace', marginTop: 8, textAlign: 'center' }}>a² + b² = ?</p>
            </div>
          )}

          {/* Inventory exhausted */}
          {invEmpty && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p style={{ color: '#f87171', fontSize: '0.78rem', lineHeight: 1.6 }}>库存已全部耗尽。</p>
              <button onClick={handleRestart} className="mt-2 w-full py-1.5 rounded-lg cursor-pointer text-sm"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                重置关卡
              </button>
            </div>
          )}

          {/* Selected preview */}
          {gs.selLen !== null && gs.phase === 'pick_material' && (
            <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(20,80,180,0.2)' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.73rem' }}>
                已选 <span style={{ color: '#ffc400', fontFamily: 'monospace' }}>{gs.selLen}m</span>
                <span style={{ color: '#334155' }}> — 点击施工按钮</span>
              </p>
            </div>
          )}

          {/* BUILD button */}
          {gs.phase === 'pick_material' && !invEmpty && !isBusy && (
            <button onClick={handleBuild} disabled={!canBuild}
              className="w-full rounded-xl py-3 text-white transition-all active:scale-95"
              style={{
                cursor: canBuild ? 'pointer' : 'default',
                background: canBuild ? 'linear-gradient(135deg,#c2410c,#ea580c)' : 'rgba(255,255,255,0.04)',
                color: canBuild ? '#fff' : '#1e3a5f',
                border: canBuild ? 'none' : '1px solid rgba(20,80,180,0.2)',
                boxShadow: canBuild ? '0 4px 18px rgba(234,88,12,0.35)' : undefined,
                fontFamily: 'monospace', fontSize: '0.88rem', letterSpacing: 1,
              }}>
              {canBuild ? '▶▶ 确认施工 / BUILD' : '— 请先选择桥材 —'}
            </button>
          )}

          {/* Building progress */}
          {isBusy && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,196,0,0.05)', border: '1px solid rgba(255,196,0,0.2)' }}>
              <p style={{ color: '#ffc400', fontSize: '0.82rem', marginBottom: 8 }}>⚙ 施工中…</p>
              <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full" style={{ width: `${gs.buildProg * 100}%`, background: 'linear-gradient(90deg,#c2410c,#ffc400)', transition: 'none' }} />
              </div>
            </div>
          )}

          {/* Walking */}
          {gs.phase === 'walking' && (
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)' }}>
              <p style={{ color: '#00e676', fontSize: '0.85rem' }}>✅ 精准连接！</p>
              <p style={{ color: '#334155', fontSize: '0.72rem', marginTop: 4 }}>角色正在过桥…</p>
            </div>
          )}

          {/* Fail */}
          {isFail && (
            <div className="rounded-xl p-3" style={{ background: gs.failKind === 'short' ? 'rgba(239,68,68,0.07)' : 'rgba(251,146,60,0.07)', border: `1px solid ${gs.failKind === 'short' ? 'rgba(239,68,68,0.3)' : 'rgba(251,146,60,0.3)'}` }}>
              <p style={{ color: gs.failKind === 'short' ? '#f87171' : '#fb923c', fontSize: '0.82rem', lineHeight: 1.55 }}>
                {gs.failKind === 'short'
                  ? (gs.installedLen && gap && Math.abs(gs.installedLen - gap.c) <= 1 ? '⚠ 差一点点！桥梁悬空…' : '⚠ 桥梁过短！无法跨越！')
                  : (gs.installedLen && gap && Math.abs(gs.installedLen - gap.c) <= 1 ? '⚠ 略微超长！撞上岩壁…' : '⚠ 桥梁过长！材料损毁！')}
              </p>
              <p style={{ color: '#334155', fontSize: '0.7rem', marginTop: 4 }}>材料已消耗，重新计算。</p>
              <div className="flex gap-2 mt-2">
                <button onClick={handleRetry} className="flex-1 py-2 rounded-lg cursor-pointer transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                  撤回重选 ↩
                </button>
                <button onClick={handleRestart} className="flex-1 py-2 rounded-lg cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.8rem' }}>
                  重置关卡
                </button>
              </div>
            </div>
          )}

          {/* pick_target prompt — only shown if truly in target-selection mode (shouldn't happen in L1 since auto-advance) */}
          {gs.phase === 'pick_target' && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(77,179,255,0.05)', border: '1px solid rgba(77,179,255,0.2)' }}>
              <p style={{ color: '#4db3ff', fontSize: '0.78rem', lineHeight: 1.6 }}>
                📍 观察两侧数字，选择合适的桥梁<br />
                <span style={{ color: '#334155' }}>每种材料只有一根，用错不退！</span>
              </p>
            </div>
          )}

          {/* Complete */}
          {gs.phase === 'complete' && (
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)' }}>
              <p style={{ color: '#00e676', fontSize: '1rem', textAlign: 'center' }}>🎉 关卡完成！</p>
              <div className="flex justify-around">
                <div className="text-center">
                  <p style={{ color: '#334155', fontSize: '0.65rem' }}>错误次数</p>
                  <p style={{ color: gs.wrong === 0 ? '#00e676' : '#f87171', fontFamily: 'monospace', fontSize: '1.5rem' }}>{gs.wrong}</p>
                </div>
                <div className="text-center">
                  <p style={{ color: '#334155', fontSize: '0.65rem' }}>架桥数</p>
                  <p style={{ color: '#4db3ff', fontFamily: 'monospace', fontSize: '1.5rem' }}>3</p>
                </div>
              </div>
              {gs.wrong === 0 && <p style={{ color: '#00e676', fontSize: '0.75rem', textAlign: 'center' }}>🏆 零失误！完美通关！</p>}
              <div className="flex gap-2">
                <button onClick={handleRestart} className="flex-1 py-2 rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
                  重玩
                </button>
                {onBack && (
                  <button onClick={onBack} className="flex-1 py-2 rounded-lg cursor-pointer" style={{ background: 'rgba(0,230,118,0.2)', color: '#00e676', border: '1px solid rgba(0,230,118,0.35)', fontSize: '0.8rem' }}>
                    关卡选择
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-auto pt-2" style={{ borderTop: '1px solid rgba(20,80,180,0.18)' }}>
            <p style={{ color: '#1e3a5f', fontSize: '0.68rem', fontFamily: 'monospace', textAlign: 'center' }}>观察数字规律 · 自主匹配桥长</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pure canvas render ───────────────────────────────────────────────────────
function renderFrame(ctx: CanvasRenderingContext2D, gs: GS, t: number, walkFrame: number) {
  ctx.clearRect(0, 0, CW, CH);
  drawBg(ctx);
  drawWater(ctx, t);

  const gap = gs.gapIdx !== null ? GAPS[gs.gapIdx] : null;
  const reachable = gs.phase === 'pick_target'
    ? GAPS.map((g, i) => ({ g, i })).filter(({ g, i }) => g.fromId === gs.charPlatId && !gs.built.includes(i)).map(({ g }) => g.toId)
    : [];

  // Platforms
  for (const p of PLATS) drawPlat(ctx, p, t, reachable, gs.charPlatId);

  // Built bridges
  for (const idx of gs.built) {
    const g = GAPS[idx];
    const { la, ra } = anch(g);
    drawBuiltBridge(ctx, la, ra, g.c);
  }

  // Active gap rendering
  if (gs.phase === 'pick_target') {
    for (const { g: rg } of GAPS.map((g, i) => ({ g, i })).filter(({ g, i }) => g.fromId === gs.charPlatId && !gs.built.includes(i))) {
      const { la: rla, ra: rra } = anch(rg);
      drawDims(ctx, rg, rla, rra);
    }
  } else if (gap) {
    const { la, ra } = anch(gap);
    if (gs.phase === 'pick_material') {
      drawDims(ctx, gap, la, ra);
      if (gs.selLen !== null) drawReady(ctx, la, ra, t);
    } else if (gs.phase === 'building') {
      drawDims(ctx, gap, la, ra);
      if (gs.installedLen !== null) drawExtBridge(ctx, la, ra, gs.installedLen, gap.c, gs.buildProg);
    } else if (gs.phase === 'fail') {
      drawDims(ctx, gap, la, ra);
      if (gs.installedLen !== null && gs.failKind) drawFailBridge(ctx, la, ra, gs.installedLen, gap.c, gs.failKind, 1);
    }
  }

  // Walking bridge (show the completed bridge while character walks)
  if (gs.phase === 'walking' && gap) {
    const { la, ra } = anch(gap);
    drawBuiltBridge(ctx, la, ra, gap.c);
  }

  // Character position
  const charPlat = getP(gs.charPlatId);
  let cx = charPlat.x + charPlat.w / 2, cy = charPlat.y;
  if (gs.phase === 'walking' && gap) {
    const fp = getP(gap.fromId), tp = getP(gap.toId);
    const startX = fp.x + fp.w - 12, startY = fp.y;
    const endX   = tp.x + 12,        endY   = tp.y;
    cx = startX + (endX - startX) * gs.walkProg;
    cy = startY + (endY - startY) * gs.walkProg;
  } else if (gs.phase === 'complete') {
    const goalP = getP('p4');
    cx = goalP.x + goalP.w / 2; cy = goalP.y;
  }
  drawChar(ctx, cx, cy, walkFrame);
}
