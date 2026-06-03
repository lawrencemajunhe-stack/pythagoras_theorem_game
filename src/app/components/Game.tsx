import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZONES, ZoneData, ZoneSite, InventoryItem } from '../data/gameData';

// ─── Canvas ───────────────────────────────────────────────────────
const CW = 700;
const CH = 430;
const WATER_Y = 365;
const PLAT_H = 50;

// ─── Types ────────────────────────────────────────────────────────
type Screen = 'title' | 'world' | 'zone' | 'zoneComplete';
type SiteStatus = 'pending' | 'completed';
type BuildPhase = 'idle' | 'animating' | 'result';
type BuildOutcome = 'none' | 'success' | 'short' | 'long';

interface Pt { x: number; y: number; }
interface PlatRect { x: number; y: number; w: number; h: number; }

interface ZoneState {
  zoneId: number;
  siteStatuses: SiteStatus[];
  inventory: InventoryItem[];
  activeSiteIndex: number;
  selectedLength: number | null;
  installedLength: number | null;
  wrongAttempts: number;
  hintsShown: number;
  assistMode: boolean;
  buildPhase: BuildPhase;
  buildOutcome: BuildOutcome;
  buildAnimProgress: number;
  charT: number;
  walkFrame: number;
}

// ─── Material catalog ─────────────────────────────────────────────
const MAT_DEFS = [
  { max: 6,  icon: '🪵', prefix: 'WB', label: '木梁' },
  { max: 12, icon: '🔩', prefix: 'ST', label: '钢梁' },
  { max: 20, icon: '⚙️', prefix: 'TR', label: '桁架' },
  { max: 99, icon: '🏗️', prefix: 'XT', label: '超桥' },
];
function matInfo(length: number) {
  const d = MAT_DEFS.find(m => length <= m.max) ?? MAT_DEFS[MAT_DEFS.length - 1];
  return { icon: d.icon, label: d.label, code: `${d.prefix}-${String(length).padStart(2, '0')}` };
}

// ─── Rounded rect helper ──────────────────────────────────────────
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const cr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + cr, y); ctx.lineTo(x + w - cr, y);
  ctx.arcTo(x + w, y, x + w, y + cr, cr); ctx.lineTo(x + w, y + h - cr);
  ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr); ctx.lineTo(x + cr, y + h);
  ctx.arcTo(x, y + h, x, y + h - cr, cr); ctx.lineTo(x, y + cr);
  ctx.arcTo(x, y, x + cr, y, cr); ctx.closePath();
}

// ─── Layout helpers ───────────────────────────────────────────────
function computePlatPositions(zone: ZoneData): PlatRect[] {
  const positions: PlatRect[] = [];
  let x = 20;
  for (let i = 0; i < zone.platforms.length; i++) {
    const y = zone.baseY - zone.platforms[i] * zone.scale;
    positions.push({ x, y, w: zone.platW, h: PLAT_H });
    if (i < zone.sites.length) x += zone.platW + zone.sites[i].a * zone.scale;
  }
  return positions;
}

function bridgeAnchors(plats: PlatRect[], idx: number): { left: Pt; right: Pt } {
  return {
    left:  { x: plats[idx].x + plats[idx].w, y: plats[idx].y },
    right: { x: plats[idx + 1].x,             y: plats[idx + 1].y },
  };
}

function charPixelPos(charT: number, plats: PlatRect[]): { x: number; y: number } {
  if (!plats.length) return { x: 20, y: 200 };
  const si = Math.max(0, Math.min(Math.floor(charT), plats.length - 1));
  const t  = charT - Math.floor(charT);
  if (si >= plats.length - 1 || !plats[si + 1]) {
    const last = plats[plats.length - 1];
    return { x: last.x + 24, y: last.y };
  }
  const la = { x: plats[si].x + plats[si].w, y: plats[si].y };
  const ra = { x: plats[si + 1].x,           y: plats[si + 1].y };
  if (t < 0.04) return { x: la.x - 22, y: la.y };
  return { x: la.x + (ra.x - la.x) * t, y: la.y + (ra.y - la.y) * t };
}

// ─── Background / water ───────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, WATER_Y - 30);
  sky.addColorStop(0, '#0f2027'); sky.addColorStop(0.45, '#1c3d54'); sky.addColorStop(1, '#2c5364');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  [[58,22],[115,14],[198,38],[308,17],[418,28],[528,11],[638,33],[678,20],[78,52],[348,48],[576,46]].forEach(([sx,sy]) => {
    ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI*2); ctx.fill();
  });
  ctx.fillStyle = '#fffde7'; ctx.beginPath(); ctx.arc(648, 52, 17, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1c3d54'; ctx.beginPath(); ctx.arc(658, 47, 14, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#162e40'; ctx.beginPath();
  ctx.moveTo(0, WATER_Y - 75);
  [[75,170],[160,115],[220,200],[310,135],[390,185],[470,108],[545,165],[620,125],[700,155]].forEach(([mx,ht]) => ctx.lineTo(mx, WATER_Y - ht));
  ctx.lineTo(700, WATER_Y - 75); ctx.closePath(); ctx.fill();
}

function drawWater(ctx: CanvasRenderingContext2D) {
  const wg = ctx.createLinearGradient(0, WATER_Y, 0, CH);
  wg.addColorStop(0, '#1565a0'); wg.addColorStop(1, '#0a2f50');
  ctx.fillStyle = wg; ctx.fillRect(0, WATER_Y, CW, CH - WATER_Y);
  ctx.strokeStyle = 'rgba(100,180,255,0.2)'; ctx.lineWidth = 1.5;
  for (let wi = 0; wi < 4; wi++) {
    ctx.beginPath(); ctx.moveTo(0, WATER_Y + 7 + wi * 10);
    for (let x = 0; x <= CW; x += 18) ctx.lineTo(x, WATER_Y + 7 + wi * 10 + Math.sin(x * 0.085 + wi) * 2);
    ctx.stroke();
  }
}

// ─── Platform ─────────────────────────────────────────────────────
function drawPlatform(ctx: CanvasRenderingContext2D, p: PlatRect) {
  const pg = ctx.createLinearGradient(p.x + 12, 0, p.x + p.w - 12, 0);
  pg.addColorStop(0, '#374151'); pg.addColorStop(0.5, '#4b5563'); pg.addColorStop(1, '#374151');
  ctx.fillStyle = pg; ctx.fillRect(p.x + 12, p.y + p.h, p.w - 24, 600);
  const sg = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
  sg.addColorStop(0, '#6b7280'); sg.addColorStop(1, '#4b5563');
  ctx.fillStyle = sg; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = '#9ca3af'; ctx.fillRect(p.x, p.y, p.w, 6);
  ctx.fillStyle = '#374151'; ctx.fillRect(p.x + p.w - 6, p.y + 6, 6, p.h - 6);
  ctx.strokeStyle = '#374151'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(p.x, p.y + p.h * 0.5); ctx.lineTo(p.x + p.w - 6, p.y + p.h * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x + p.w * 0.35, p.y + 6); ctx.lineTo(p.x + p.w * 0.35, p.y + p.h - 1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x + p.w * 0.68, p.y + 6); ctx.lineTo(p.x + p.w * 0.68, p.y + p.h - 1); ctx.stroke();
}

// ─── Bridge drawing helpers ───────────────────────────────────────
function _drawBridgeBeam(ctx: CanvasRenderingContext2D, la: Pt, end: Pt, mainColor: string, hiColor: string, plankColor: string) {
  const dx = end.x - la.x, dy = end.y - la.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(la.x + 2, la.y + 2); ctx.lineTo(end.x + 2, end.y + 2); ctx.stroke();
  ctx.strokeStyle = mainColor; ctx.lineWidth = 10; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(end.x, end.y); ctx.stroke();
  ctx.strokeStyle = hiColor; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(la.x, la.y - 1); ctx.lineTo(end.x, end.y - 1); ctx.stroke();
  if (len > 15) {
    const planks = Math.max(2, Math.floor(len / 20));
    ctx.strokeStyle = plankColor; ctx.lineWidth = 2; ctx.setLineDash([]);
    for (let i = 1; i < planks; i++) {
      const t = i / planks;
      const px = la.x + dx * t, py = la.y + dy * t;
      ctx.beginPath(); ctx.moveTo(px + uy * 6, py - ux * 6); ctx.lineTo(px - uy * 6, py + ux * 6); ctx.stroke();
    }
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, type: 'solid' | 'wrong') {
  ctx.save();
  if (type === 'solid') {
    _drawBridgeBeam(ctx, la, ra, '#92400e', '#b45309', '#78350f');
  } else {
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.setLineDash([12, 6]);
    ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(ra.x, ra.y); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// Draw bridge extending from la toward ra, at given progress (0→1), endpoint = chosenPx pixels along direction
function drawExtendingBridge(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, installedLen: number, correctC: number, progress: number) {
  const dx = ra.x - la.x, dy = ra.y - la.y;
  const correctPx = Math.sqrt(dx * dx + dy * dy);
  if (correctPx === 0) return;
  const ux = dx / correctPx, uy = dy / correctPx;
  const chosenPx = (installedLen / correctC) * correctPx;
  const currentPx = chosenPx * progress;
  if (currentPx < 1) return;
  const ex = la.x + ux * currentPx, ey = la.y + uy * currentPx;
  ctx.save();
  _drawBridgeBeam(ctx, la, { x: ex, y: ey }, '#92400e', '#b45309', '#78350f');
  // Construction tip glow
  if (progress < 1) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Draw the final state of a short or long bridge
function drawFailedBridge(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, installedLen: number, correctC: number, outcome: BuildOutcome) {
  const dx = ra.x - la.x, dy = ra.y - la.y;
  const correctPx = Math.sqrt(dx * dx + dy * dy);
  if (correctPx === 0) return;
  const ux = dx / correctPx, uy = dy / correctPx;
  const chosenPx = (installedLen / correctC) * correctPx;
  const ex = la.x + ux * chosenPx, ey = la.y + uy * chosenPx;

  ctx.save();
  if (outcome === 'short') {
    // Draw incomplete red bridge
    _drawBridgeBeam(ctx, la, { x: ex, y: ey }, '#7f1d1d', '#991b1b', '#450a0a');
    // Dashed gap to show what's missing
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ra.x, ra.y); ctx.stroke();
    ctx.setLineDash([]);
    // Dangling end marker
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(239,68,68,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.stroke();
  } else if (outcome === 'long') {
    // Draw correct portion (wood colored)
    _drawBridgeBeam(ctx, la, ra, '#92400e', '#b45309', '#78350f');
    // Draw overshoot portion (red)
    _drawBridgeBeam(ctx, ra, { x: ex, y: ey }, '#991b1b', '#ef4444', '#7f1d1d');
    // Impact sparks at ra
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sr = 10 + Math.random() * 4;
      ctx.beginPath(); ctx.arc(ra.x + Math.cos(angle) * sr, ra.y + Math.sin(angle) * sr, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(251,191,36,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ra.x, ra.y, 13, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Show build-ready anchor + direction arrow (replaces ghost bridge)
function drawConstructionReadyIndicator(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt) {
  const dx = ra.x - la.x, dy = ra.y - la.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const ux = dx / len, uy = dy / len;

  ctx.save();
  // Glow at anchor
  const grad = ctx.createRadialGradient(la.x, la.y, 0, la.x, la.y, 16);
  grad.addColorStop(0, 'rgba(250,204,21,0.7)');
  grad.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(la.x, la.y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath(); ctx.arc(la.x, la.y, 5, 0, Math.PI * 2); ctx.fill();

  // Short direction arrow (~22% of gap)
  const arrowLen = Math.min(len * 0.22, 32);
  const ax = la.x + ux * arrowLen, ay = la.y + uy * arrowLen;
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(ax, ay); ctx.stroke();
  const ang = Math.atan2(uy, ux), as = 7;
  ctx.fillStyle = '#facc15'; ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - as * Math.cos(ang - 0.45), ay - as * Math.sin(ang - 0.45));
  ctx.lineTo(ax - as * Math.cos(ang + 0.45), ay - as * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fill();

  // "准备施工" tag above anchor
  const tag = '⚙ 准备施工';
  ctx.font = 'bold 10px sans-serif';
  const tw = ctx.measureText(tag).width + 10;
  const labelY = la.y - 22;
  ctx.fillStyle = 'rgba(10,25,40,0.88)';
  roundedRect(ctx, la.x - tw / 2, labelY - 9, tw, 17, 4); ctx.fill();
  ctx.fillStyle = '#facc15'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tag, la.x, labelY);
  ctx.restore();
}

// ─── Triangle guide (a/b visual) ─────────────────────────────────
function drawTriangleGuide(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt) {
  const cx = ra.x, cy = la.y;
  const vd = ra.y < la.y ? -1 : 1;
  ctx.save();
  ctx.globalAlpha = 0.6; ctx.setLineDash([8, 5]);
  ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.strokeStyle = '#4ade80';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ra.x, ra.y); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
  const sq = 11;
  ctx.beginPath(); ctx.moveTo(cx - sq, cy); ctx.lineTo(cx - sq, cy + vd * sq); ctx.lineTo(cx, cy + vd * sq); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#93c5fd'; ctx.textAlign = 'center';
  ctx.fillText('a', (la.x + cx) / 2, la.y + (vd > 0 ? -7 : 20));
  ctx.fillStyle = '#86efac'; ctx.textAlign = 'left';
  ctx.fillText('b', cx + 5, (cy + ra.y) / 2 + 5);
  ctx.restore();
}

// ─── Site highlight box ───────────────────────────────────────────
function drawSiteHighlight(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt) {
  ctx.save();
  ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
  const minX = la.x - 4, maxX = ra.x + 4;
  const minY = Math.min(la.y, ra.y) - 16, maxY = Math.max(la.y, ra.y) + 16;
  roundedRect(ctx, minX, minY, maxX - minX, maxY - minY, 6); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}

// ─── Labels ───────────────────────────────────────────────────────
function drawMeasurementLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.save(); ctx.font = 'bold 12px monospace';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(10,25,40,0.85)';
  roundedRect(ctx, x - w / 2, y - 11, w, 20, 4); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y); ctx.restore();
}

function drawCompletedBridgeLabel(ctx: CanvasRenderingContext2D, la: Pt, ra: Pt, c: number) {
  const mx = (la.x + ra.x) / 2 - 12, my = (la.y + ra.y) / 2 - 14;
  ctx.save(); ctx.font = 'bold 11px monospace';
  const txt = `${c}m`, w = ctx.measureText(txt).width + 8;
  ctx.fillStyle = 'rgba(10,25,40,0.8)';
  roundedRect(ctx, mx - w / 2, my - 9, w, 17, 3); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, mx, my); ctx.restore();
}

// ─── Character ───────────────────────────────────────────────────
// y = foot level (platform / bridge surface). Everything is drawn upward from here.
function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, wf: number) {
  ctx.save();
  const hR = 8, body = 16, leg = 13;
  const hip = y - leg;          // hip joint sits leg-height above the surface
  const shoulder = hip - body;  // top of torso

  ctx.strokeStyle = '#fde68a'; ctx.fillStyle = '#fde68a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  // Head
  ctx.beginPath(); ctx.arc(x, shoulder - hR, hR, 0, Math.PI * 2); ctx.fill();
  // Hat brim + crown
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath(); ctx.arc(x, shoulder - hR * 1.85, 10, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 6, shoulder - hR * 2.5, 12, 5);
  // Torso (spine)
  ctx.strokeStyle = '#fde68a'; ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.moveTo(x, shoulder); ctx.lineTo(x, hip); ctx.stroke();
  // Arms
  ctx.beginPath(); ctx.moveTo(x - 8, shoulder + body * 0.4); ctx.lineTo(x + 8, shoulder + body * 0.4); ctx.stroke();
  // Legs — feet land exactly on y (the surface)
  if (wf === 0) {
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x - 6, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + 4, y); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + 6, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x - 4, y); ctx.stroke();
  }
  ctx.restore();
}

// ─── Triangle SVG ─────────────────────────────────────────────────
function TriangleDiagram({ site, assistMode }: { site: ZoneSite; assistMode: boolean }) {
  const W = 186, H = 136, pad = 26;
  const maxA = W - pad * 2, maxB = H - pad * 2 - 20;
  const s = Math.min(maxA / Math.max(site.a, 1), maxB / Math.max(site.b, 1));
  const aPx = site.a * s, bPx = site.b * s;
  const cX = W - pad, cY = H - pad;
  const aX = cX - aPx, aY = cY, bX = cX, bY = cY - bPx;
  const sq = 9;
  const aSquared = site.a * site.a, bSquared = site.b * site.b, cSquared = aSquared + bSquared;
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <line x1={aX} y1={aY} x2={cX} y2={cY} stroke="#60a5fa" strokeWidth={2.5} />
      <line x1={cX} y1={cY} x2={bX} y2={bY} stroke="#4ade80" strokeWidth={2.5} />
      <line x1={aX} y1={aY} x2={bX} y2={bY} stroke="#fb923c" strokeWidth={3} strokeDasharray="8,4" />
      <path d={`M${cX - sq},${cY} L${cX - sq},${cY - sq} L${cX},${cY - sq}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      <text x={(aX + cX) / 2} y={cY + 16} fill="#93c5fd" textAnchor="middle" fontSize={12}>a = {site.a}</text>
      <text x={cX + 12} y={(cY + bY) / 2 + 4} fill="#86efac" fontSize={12}>b = {site.b}</text>
      <text x={(aX + bX) / 2 - 14} y={(aY + bY) / 2 - 4} textAnchor="end" fill="#fb923c" fontSize={12}>c = ?</text>
      {assistMode && (
        <>
          <rect x={0} y={0} width={W} height={21} rx={4} fill="rgba(10,20,35,0.92)" />
          <text x={W / 2} y={14} fill="#fcd34d" textAnchor="middle" fontSize={11}>
            {site.a}² + {site.b}² = {aSquared} + {bSquared} = {cSquared}
          </text>
        </>
      )}
    </svg>
  );
}

// ─── State factory ────────────────────────────────────────────────
function makeZoneState(zone: ZoneData): ZoneState {
  return {
    zoneId: zone.id,
    siteStatuses: zone.sites.map(() => 'pending' as SiteStatus),
    inventory: zone.initialInventory.map(it => ({ ...it })),
    activeSiteIndex: 0,
    selectedLength: null,
    installedLength: null,
    wrongAttempts: 0,
    hintsShown: 0,
    assistMode: false,
    buildPhase: 'idle',
    buildOutcome: 'none',
    buildAnimProgress: 0,
    charT: 0,
    walkFrame: 0,
  };
}

// ─── Main Game component ──────────────────────────────────────────
export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen,       setScreen]       = useState<Screen>('title');
  const [currentZoneId, setCurrentZoneId] = useState(1);
  const [zoneProgress, setZoneProgress] = useState<Record<number, { stars: number; score: number }>>({});
  const [zs, setZs] = useState<ZoneState>(() => makeZoneState(ZONES[0]));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const zone = ZONES.find(z => z.id === currentZoneId) ?? ZONES[0];

  // ─── Canvas draw ─────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);
    drawBackground(ctx);
    drawWater(ctx);
    if (screen !== 'zone') return;

    const plats = computePlatPositions(zone);
    plats.forEach(p => drawPlatform(ctx, p));

    zone.sites.forEach((site, i) => {
      if (i + 1 >= plats.length) return;
      const { left: la, right: ra } = bridgeAnchors(plats, i);
      const status = zs.siteStatuses[i];

      if (status === 'completed') {
        drawBridge(ctx, la, ra, 'solid');
        drawCompletedBridgeLabel(ctx, la, ra, site.c);
        return;
      }

      if (i === zs.activeSiteIndex) {
        const cx = ra.x, cy = la.y;
        const vd = ra.y < la.y ? -1 : 1;

        if (zs.buildPhase === 'result' && zs.buildOutcome === 'success') {
          // Solid bridge during walk / just after success
          drawBridge(ctx, la, ra, 'solid');
          drawCompletedBridgeLabel(ctx, la, ra, site.c);

        } else if (zs.buildPhase === 'animating') {
          // Construction animation
          drawSiteHighlight(ctx, la, ra);
          drawMeasurementLabel(ctx, `a = ${site.a}`, (la.x + cx) / 2, la.y + (vd > 0 ? 19 : -12), '#93c5fd');
          drawMeasurementLabel(ctx, `b = ${site.b}`, cx + 32, (cy + ra.y) / 2, '#86efac');
          if (zs.installedLength !== null) {
            drawExtendingBridge(ctx, la, ra, zs.installedLength, site.c, zs.buildAnimProgress);
          }

        } else if (zs.buildPhase === 'result') {
          // Failed result — show stuck bridge
          drawSiteHighlight(ctx, la, ra);
          drawMeasurementLabel(ctx, `a = ${site.a}`, (la.x + cx) / 2, la.y + (vd > 0 ? 19 : -12), '#93c5fd');
          drawMeasurementLabel(ctx, `b = ${site.b}`, cx + 32, (cy + ra.y) / 2, '#86efac');
          if (zs.installedLength !== null) {
            drawFailedBridge(ctx, la, ra, zs.installedLength, site.c, zs.buildOutcome);
          }

        } else {
          // Idle — show guide + optional ready indicator
          drawTriangleGuide(ctx, la, ra);
          drawSiteHighlight(ctx, la, ra);
          drawMeasurementLabel(ctx, `a = ${site.a}`, (la.x + cx) / 2, la.y + (vd > 0 ? 19 : -12), '#93c5fd');
          drawMeasurementLabel(ctx, `b = ${site.b}`, cx + 32, (cy + ra.y) / 2, '#86efac');
          if (zs.selectedLength !== null) {
            drawConstructionReadyIndicator(ctx, la, ra);
          }
        }

      } else {
        // Inactive pending site — faint placeholder
        ctx.save();
        ctx.strokeStyle = 'rgba(100,130,160,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(la.x, la.y); ctx.lineTo(ra.x, ra.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(100,130,160,0.35)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('?', (la.x + ra.x) / 2, (la.y + ra.y) / 2 - 6);
        ctx.restore();
      }
    });

    const cp = charPixelPos(zs.charT, plats);
    drawCharacter(ctx, cp.x, cp.y, zs.walkFrame);
  }, [screen, zone, zs]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // ─── Construction animation ───────────────────────────────────
  useEffect(() => {
    if (zs.buildPhase !== 'animating') return;
    let rafId: number;
    let cancelled = false;
    const start = performance.now();
    const DURATION = 1800;

    const animate = (time: number) => {
      if (cancelled || !mountedRef.current) return;
      const progress = Math.min((time - start) / DURATION, 1);
      setZs(prev => ({ ...prev, buildAnimProgress: progress }));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        if (!mountedRef.current) return;
        // Brief dramatic pause before revealing result
        setTimeout(() => {
          if (!mountedRef.current || cancelled) return;
          setZs(prev => ({ ...prev, buildPhase: 'result', buildAnimProgress: 1 }));
        }, 150);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zs.buildPhase]);

  // ─── Walk animation (success) ─────────────────────────────────
  useEffect(() => {
    if (zs.buildPhase !== 'result' || zs.buildOutcome !== 'success') return;
    let rafId: number;
    let cancelled = false;
    const start = performance.now();
    const fromT = zs.charT;
    const toT   = zs.activeSiteIndex + 1;
    const platCount = zone.platforms.length;

    const animate = (time: number) => {
      if (cancelled || !mountedRef.current) return;
      const t = Math.min((time - start) / 2000, 1);
      const newCharT = fromT + (toT - fromT) * t;
      const wf = Math.floor(time / 140) % 2;
      setZs(prev => ({ ...prev, charT: newCharT, walkFrame: wf }));

      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        if (!mountedRef.current) return;
        setZs(prev => {
          const newStatuses = [...prev.siteStatuses];
          newStatuses[prev.activeSiteIndex] = 'completed';
          const nextActive = prev.activeSiteIndex + 1;
          return {
            ...prev,
            charT: toT,
            walkFrame: 0,
            siteStatuses: newStatuses,
            activeSiteIndex: nextActive,
            installedLength: null,
            hintsShown: 0,
            buildPhase: 'idle',
            buildOutcome: 'none',
            buildAnimProgress: 0,
          };
        });
        if (toT >= platCount - 1) {
          setTimeout(() => {
            if (mountedRef.current) setScreen('zoneComplete');
          }, 600);
        }
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zs.buildPhase, zs.buildOutcome]);

  // ─── Game handlers ────────────────────────────────────────────
  const handleSelectMaterial = (length: number) => {
    if (zs.buildPhase !== 'idle') return;
    setZs(prev => ({ ...prev, selectedLength: prev.selectedLength === length ? null : length }));
  };

  const handleBuild = () => {
    if (zs.buildPhase !== 'idle' || zs.selectedLength === null) return;
    const site = zone.sites[zs.activeSiteIndex];
    if (!site) return;
    const diff = Math.abs(zs.selectedLength - site.c);
    const outcome: BuildOutcome = diff <= site.tolerance
      ? 'success'
      : zs.selectedLength < site.c
      ? 'short'
      : 'long';

    const newInv = zs.inventory
      .map(item => item.length === zs.selectedLength ? { ...item, count: item.count - 1 } : item)
      .filter(item => item.count > 0);

    setZs(prev => ({
      ...prev,
      inventory: newInv,
      installedLength: prev.selectedLength,
      selectedLength: null,
      buildPhase: 'animating',
      buildOutcome: outcome,
      buildAnimProgress: 0,
      wrongAttempts: outcome === 'success' ? prev.wrongAttempts : prev.wrongAttempts + 1,
    }));
  };

  const handleRetry = () => {
    setZs(prev => ({
      ...prev,
      buildPhase: 'idle',
      buildOutcome: 'none',
      buildAnimProgress: 0,
      installedLength: null,
      selectedLength: null,
    }));
  };

  const handleRevealHint = () => {
    const maxHints = zone.sites[zs.activeSiteIndex]?.hints.length ?? 0;
    if (zs.hintsShown < maxHints) setZs(prev => ({ ...prev, hintsShown: prev.hintsShown + 1 }));
  };

  const saveProgress = (wrongAttempts: number) => {
    const stars = wrongAttempts === 0 ? 3 : wrongAttempts <= 2 ? 2 : 1;
    const score = Math.max(10, 100 - wrongAttempts * 12);
    setZoneProgress(prev => {
      const existing = prev[currentZoneId];
      const updated = { stars: Math.max(stars, existing?.stars ?? 0), score: Math.max(score, existing?.score ?? 0) };
      const nextId = currentZoneId + 1;
      const nextEntry = nextId <= ZONES.length ? { [nextId]: prev[nextId] ?? { stars: 0, score: 0 } } : {};
      return { ...prev, [currentZoneId]: updated, ...nextEntry };
    });
  };

  const handleStartZone = (zoneId: number) => {
    const z = ZONES.find(zi => zi.id === zoneId);
    if (!z) return;
    setCurrentZoneId(zoneId);
    setZs(makeZoneState(z));
    setScreen('zone');
  };

  // ─── Derived values ───────────────────────────────────────────
  const activeSite: ZoneSite | null = zone.sites[zs.activeSiteIndex] ?? null;
  const allCompleted  = zs.activeSiteIndex >= zone.sites.length;
  const diffStars     = (d: 1 | 2 | 3) => '★'.repeat(d) + '☆'.repeat(3 - d);
  const starDisplay   = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);
  const completedCount = zs.siteStatuses.filter(s => s === 'completed').length;
  const piecesLeft    = zs.inventory.reduce((s, i) => s + i.count, 0);

  // Closeness feedback text
  const failFeedback = (() => {
    if (!activeSite || !zs.installedLength) return '';
    const diff = Math.abs(zs.installedLength - activeSite.c);
    const isClose = diff <= 1;
    if (zs.buildOutcome === 'short') {
      return isClose ? '⚠️ 差一点点！桥梁悬空，几乎够到了...' : '⚠️ 桥梁太短！无法跨越断崖，重新计算！';
    }
    if (zs.buildOutcome === 'long') {
      return isClose ? '⚠️ 略微超长！桥梁撞上了岩壁...' : '⚠️ 桥梁过长！撞上对岸，材料损毁！';
    }
    return '';
  })();

  // ─── Title screen ─────────────────────────────────────────────
  if (screen === 'title') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg,#0f2027,#1c3d54,#2c5364)' }}>
        <div className="flex flex-col items-center gap-6 max-w-lg text-center">
          <div style={{ fontSize: 68 }}>🌉</div>
          <div>
            <h1 className="text-white" style={{ fontSize: '2.1rem', lineHeight: 1.3 }}>勾股桥工程师</h1>
            <p style={{ color: '#93c5fd' }}>Bridge Engineer · Pythagorean Theorem</p>
          </div>
          <div className="rounded-2xl p-5 text-left" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', maxWidth: 390 }}>
            <p style={{ color: '#e2e8f0', lineHeight: 1.75 }}>
              你是桥梁工程师，仓库里有各种规格的建材，但<strong style={{ color: '#fb923c' }}>数量有限</strong>！<br />
              每处断崖的水平距离（a）和高度差（b）已知，用<strong style={{ color: '#fbbf24' }}>勾股定理</strong>算出桥长，
              选对材料确认施工——用错一次就会<strong style={{ color: '#f87171' }}>浪费一根！</strong>
            </p>
            <div className="mt-3 rounded-xl p-3 text-center" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <span style={{ color: '#c7d2fe', fontFamily: 'monospace' }}>a² + b² = c²&nbsp;&nbsp;→&nbsp;&nbsp;c = √(a² + b²)</span>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap justify-center">
            {[['📐', '3个区域'], ['🏗️', '工程建造制'], ['⭐', '星级评分']].map(([ic, lb]) => (
              <span key={lb} style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{ic} {lb}</span>
            ))}
          </div>
          <button onClick={() => setScreen('world')}
            className="px-10 py-4 rounded-2xl text-white cursor-pointer active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)', fontSize: '1.1rem', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}>
            🚀 开始建桥！
          </button>
        </div>
      </div>
    );
  }

  // ─── World map ────────────────────────────────────────────────
  if (screen === 'world') {
    const totalScore = Object.values(zoneProgress).reduce((s, z) => s + z.score, 0);
    return (
      <div className="min-h-screen flex flex-col p-4 gap-4"
        style={{ background: 'linear-gradient(160deg,#0f2027,#1c3d54,#2c5364)' }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white" style={{ fontSize: '1.6rem' }}>🗺️ 选择关卡</h1>
            <p style={{ color: '#64748b', fontSize: '0.8rem' }}>完成区域解锁下一关</p>
          </div>
          <div style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: '1.4rem' }}>
            {totalScore} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>分</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {ZONES.map((z, idx) => {
            const progress = zoneProgress[z.id];
            const isUnlocked = z.id === 1 || progress !== undefined || zoneProgress[z.id - 1] !== undefined;
            const isCompleted = progress && progress.stars > 0;
            return (
              <button key={z.id}
                onClick={() => { if (isUnlocked) handleStartZone(z.id); }}
                disabled={!isUnlocked}
                className="flex-1 rounded-2xl p-5 text-left flex flex-col gap-3 transition-all active:scale-95"
                style={{
                  cursor: isUnlocked ? 'pointer' : 'default',
                  background: isUnlocked ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCompleted ? 'rgba(251,191,36,0.35)' : isUnlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: isUnlocked ? 1 : 0.45,
                }}>
                <div className="flex justify-between items-start">
                  <span style={{ fontSize: '2.5rem' }}>{isUnlocked ? z.emoji : '🔒'}</span>
                  {isCompleted && <span style={{ fontSize: '0.85rem' }}>{starDisplay(progress.stars)}</span>}
                </div>
                <div>
                  <p className="text-white" style={{ fontSize: '1.2rem' }}>区域 {idx + 1}：{z.name}</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{z.subtitle}</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4 }}>
                    {diffStars(z.difficulty)} &nbsp; {z.sites.length} 座桥
                  </p>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.55 }}>{z.description}</p>
                {isCompleted
                  ? <div className="mt-auto"><span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: '0.85rem' }}>最高 {progress.score} 分</span></div>
                  : !isUnlocked && <p style={{ color: '#475569', fontSize: '0.78rem' }}>完成上一区域解锁</p>
                }
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Zone complete ────────────────────────────────────────────
  if (screen === 'zoneComplete') {
    const stars = zs.wrongAttempts === 0 ? 3 : zs.wrongAttempts <= 2 ? 2 : 1;
    const score = Math.max(10, 100 - zs.wrongAttempts * 12);
    const hasNext = currentZoneId < ZONES.length;
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg,#0f2027,#1c3d54,#2c5364)' }}>
        <div className="flex flex-col items-center gap-5 max-w-md text-center">
          <div style={{ fontSize: '3.5rem' }}>🎉</div>
          <h1 style={{ color: '#fbbf24', fontSize: '1.8rem' }}>区域完成！</h1>
          <div style={{ fontSize: '2rem' }}>{starDisplay(stars)}</div>
          <div className="rounded-2xl p-5 w-full" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex justify-around">
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>得分</p>
                <p style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: '2rem' }}>{score}</p>
              </div>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>错误次数</p>
                <p style={{ color: zs.wrongAttempts === 0 ? '#4ade80' : '#f87171', fontFamily: 'monospace', fontSize: '2rem' }}>{zs.wrongAttempts}</p>
              </div>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>建桥数</p>
                <p style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: '2rem' }}>{zone.sites.length}</p>
              </div>
            </div>
            {zs.wrongAttempts === 0 && (
              <div className="mt-3 rounded-xl p-2" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}>
                <p style={{ color: '#4ade80', fontSize: '0.82rem' }}>🏆 完美！零失误通关！勾股定理掌握得很好！</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => { setZs(makeZoneState(zone)); setScreen('zone'); }}
              className="flex-1 py-3 rounded-xl cursor-pointer text-white"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              🔄 再玩一次
            </button>
            {hasNext ? (
              <button
                onClick={() => { saveProgress(zs.wrongAttempts); handleStartZone(currentZoneId + 1); }}
                className="flex-1 py-3 rounded-xl cursor-pointer text-white"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                下一区域 →
              </button>
            ) : (
              <button
                onClick={() => { saveProgress(zs.wrongAttempts); setScreen('world'); }}
                className="flex-1 py-3 rounded-xl cursor-pointer text-white"
                style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                🗺️ 返回地图
              </button>
            )}
          </div>
          <button onClick={() => { saveProgress(zs.wrongAttempts); setScreen('world'); }}
            className="cursor-pointer" style={{ color: '#475569', fontSize: '0.78rem' }}>
            返回世界地图
          </button>
        </div>
      </div>
    );
  }

  // ─── Zone play ────────────────────────────────────────────────
  const canBuild  = zs.buildPhase === 'idle' && zs.selectedLength !== null;
  const isBusy    = zs.buildPhase === 'animating';
  const isSuccess = zs.buildPhase === 'result' && zs.buildOutcome === 'success';
  const isFailed  = zs.buildPhase === 'result' && (zs.buildOutcome === 'short' || zs.buildOutcome === 'long');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f1923' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('world')} style={{ color: '#475569', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
          <span style={{ fontSize: '1.4rem' }}>{zone.emoji}</span>
          <div>
            <p className="text-white" style={{ fontWeight: 600, lineHeight: 1.2 }}>区域 {zone.id}：{zone.name} · {zone.subtitle}</p>
            <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
              {diffStars(zone.difficulty)}&nbsp;&nbsp;剩余 {zone.sites.length - completedCount} 座桥 · {piecesLeft} 根材料
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div style={{ color: zs.wrongAttempts > 0 ? '#f87171' : '#4ade80', fontSize: '0.85rem', fontFamily: 'monospace' }}>
            ✗ {zs.wrongAttempts}
          </div>
          <div className="hidden sm:flex gap-1.5">
            {zone.sites.map((_, i) => (
              <div key={i} className="rounded-full" style={{
                width: 9, height: 9,
                background: zs.siteStatuses[i] === 'completed' ? '#4ade80'
                  : i === zs.activeSiteIndex ? '#facc15' : '#1e3a5f',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Canvas */}
        <div className="relative flex items-center justify-center p-2" style={{ flex: '1 1 0', minHeight: 260 }}>
          <canvas ref={canvasRef} width={CW} height={CH}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', display: 'block' }} />
          {allCompleted && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
              <button onClick={() => setScreen('zoneComplete')}
                className="px-8 py-4 rounded-2xl text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)', fontSize: '1.1rem', boxShadow: '0 8px 30px rgba(5,150,105,0.4)' }}>
                🎉 区域完成！查看结果
              </button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="shrink-0 flex flex-col gap-3 p-3 lg:p-4 overflow-y-auto"
          style={{ width: '100%', maxWidth: 310, minWidth: 260, background: 'rgba(0,0,0,0.3)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Site info */}
          {activeSite && !allCompleted && (
            <>
              <div className="rounded-xl p-3" style={{ background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.2)' }}>
                <div className="flex justify-between items-center mb-2">
                  <p style={{ color: '#fbbf24', fontSize: '0.82rem' }}>📍 当前桥址 #{zs.activeSiteIndex + 1}</p>
                  <p style={{ color: '#64748b', fontSize: '0.72rem' }}>{zs.activeSiteIndex + 1} / {zone.sites.length}</p>
                </div>
                <div className="flex gap-3 justify-center items-center">
                  <div className="text-center">
                    <p style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: '1.5rem', lineHeight: 1.1 }}>{activeSite.a}</p>
                    <p style={{ color: '#475569', fontSize: '0.7rem' }}>水平 a</p>
                  </div>
                  <span style={{ color: '#334155' }}>+</span>
                  <div className="text-center">
                    <p style={{ color: '#86efac', fontFamily: 'monospace', fontSize: '1.5rem', lineHeight: 1.1 }}>{activeSite.b}</p>
                    <p style={{ color: '#475569', fontSize: '0.7rem' }}>高差 b</p>
                  </div>
                  <span style={{ color: '#334155' }}>→</span>
                  <div className="text-center">
                    <p style={{ color: '#fb923c', fontFamily: 'monospace', fontSize: '1.5rem', lineHeight: 1.1 }}>?</p>
                    <p style={{ color: '#475569', fontSize: '0.7rem' }}>桥长 c</p>
                  </div>
                </div>
              </div>

              {/* Triangle SVG */}
              <div className="rounded-xl p-2 flex flex-col items-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ color: '#334155', fontSize: '0.7rem', marginBottom: 4 }}>直角三角形图示</p>
                <TriangleDiagram site={activeSite} assistMode={zs.assistMode} />
              </div>

              {/* Assist mode formula */}
              {zs.assistMode && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}>
                  <p style={{ color: '#fbbf24', fontSize: '0.75rem', marginBottom: 5 }}>📐 公式展开</p>
                  {[
                    [`a² + b² = c²`,                                               '#e2e8f0'],
                    [`${activeSite.a}² + ${activeSite.b}² = c²`,                   '#93c5fd'],
                    [`${activeSite.a ** 2} + ${activeSite.b ** 2} = c²`,           '#86efac'],
                    [`${activeSite.a ** 2 + activeSite.b ** 2} = c²`,              '#fbbf24'],
                    [`c = √${activeSite.a ** 2 + activeSite.b ** 2} = ?`,          '#fb923c'],
                  ].map(([line, color]) => (
                    <p key={line} style={{ color, fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.7 }}>{line}</p>
                  ))}
                </div>
              )}

              {/* Hints */}
              {zs.hintsShown > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {activeSite.hints.slice(0, zs.hintsShown).map((h, i) => (
                    <p key={i} style={{ color: '#c7d2fe', fontSize: '0.82rem', lineHeight: 1.65 }}>{h}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Material inventory (hidden during success walk / all completed) ── */}
          {!allCompleted && activeSite && !isSuccess && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <p style={{ color: '#475569', fontSize: '0.75rem' }}>🏗️ 建材仓库</p>
                <p style={{ color: '#334155', fontSize: '0.7rem' }}>{piecesLeft} 根剩余</p>
              </div>

              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {zs.inventory.map(item => {
                  const mat = matInfo(item.length);
                  const isSelected = item.length === zs.selectedLength;
                  const disabled = !isFailed && zs.buildPhase !== 'idle';
                  return (
                    <button key={item.length}
                      onClick={() => handleSelectMaterial(item.length)}
                      disabled={disabled}
                      className="rounded-xl py-2 px-1 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                      style={{
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                        background: isSelected ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)',
                        border: `1.5px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                        boxShadow: isSelected ? '0 0 12px rgba(59,130,246,0.3)' : undefined,
                      }}>
                      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{mat.icon}</span>
                      <span style={{ color: '#4b5563', fontSize: '0.5rem', letterSpacing: 0.5, lineHeight: 1 }}>{mat.code}</span>
                      <span style={{ color: '#f1f5f9', fontFamily: 'monospace', fontSize: '1.1rem', lineHeight: 1.1 }}>{item.length}m</span>
                      <span style={{ color: item.count <= 1 ? '#f87171' : '#475569', fontSize: '0.6rem' }}>×{item.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selection preview */}
              {zs.selectedLength !== null && zs.buildPhase === 'idle' && (
                <div className="rounded-xl p-2 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    已选 <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{zs.selectedLength}m 建材</span>
                    <span style={{ color: '#475569' }}> — 确认施工后见结果</span>
                  </p>
                </div>
              )}

              {/* Build / state button */}
              {zs.buildPhase === 'idle' && (
                <button onClick={handleBuild} disabled={!canBuild}
                  className="w-full rounded-xl py-3 text-white transition-all active:scale-95"
                  style={{
                    cursor: canBuild ? 'pointer' : 'default',
                    background: canBuild
                      ? 'linear-gradient(135deg,#b45309,#d97706)'
                      : 'rgba(255,255,255,0.05)',
                    color: canBuild ? '#fff' : '#334155',
                    boxShadow: canBuild ? '0 4px 20px rgba(180,83,9,0.4)' : undefined,
                  }}>
                  🏗️ 确认施工！
                </button>
              )}

              {/* Animating state */}
              {isBusy && (
                <div className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.25)' }}>
                  <p style={{ color: '#fbbf24', fontSize: '0.85rem' }}>⚙️ 施工中，等待结果揭晓...</p>
                  <div className="mt-2 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${zs.buildAnimProgress * 100}%`,
                      background: 'linear-gradient(90deg,#b45309,#fbbf24)',
                    }} />
                  </div>
                </div>
              )}

              {/* Failed result feedback */}
              {isFailed && (
                <div className="rounded-xl p-3 flex flex-col gap-2"
                  style={{
                    background: zs.buildOutcome === 'short' ? 'rgba(239,68,68,0.08)' : 'rgba(251,146,60,0.08)',
                    border: `1px solid ${zs.buildOutcome === 'short' ? 'rgba(239,68,68,0.35)' : 'rgba(251,146,60,0.35)'}`,
                  }}>
                  <p style={{ color: zs.buildOutcome === 'short' ? '#f87171' : '#fb923c', fontSize: '0.82rem' }}>
                    {failFeedback}
                  </p>
                  <p style={{ color: '#475569', fontSize: '0.72rem' }}>材料已消耗，重新计算后再选。</p>
                  <button onClick={handleRetry}
                    className="w-full py-2 rounded-lg cursor-pointer transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.12)' }}>
                    重新选材 →
                  </button>
                </div>
              )}

              {/* Hint / Assist controls (hide during animation/result) */}
              {zs.buildPhase === 'idle' && (
                <div className="flex gap-2">
                  <button onClick={handleRevealHint}
                    disabled={zs.hintsShown >= (activeSite?.hints.length ?? 0)}
                    className="flex-1 rounded-xl py-2 transition-all"
                    style={{
                      cursor: zs.hintsShown < (activeSite?.hints.length ?? 0) ? 'pointer' : 'default',
                      background: zs.hintsShown < (activeSite?.hints.length ?? 0) ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: zs.hintsShown < (activeSite?.hints.length ?? 0) ? '#cbd5e1' : '#334155',
                      fontSize: '0.8rem',
                    }}>
                    💡 提示 ({zs.hintsShown}/{activeSite?.hints.length ?? 0})
                  </button>
                  <button onClick={() => setZs(p => ({ ...p, assistMode: !p.assistMode }))}
                    className="flex-1 rounded-xl py-2 cursor-pointer transition-all"
                    style={{
                      background: zs.assistMode ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${zs.assistMode ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.1)'}`,
                      color: zs.assistMode ? '#fbbf24' : '#cbd5e1',
                      fontSize: '0.8rem',
                    }}>
                    📐 辅助{zs.assistMode ? ' ON' : ''}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success walking message */}
          {isSuccess && (
            <div className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <p style={{ color: '#4ade80', fontSize: '0.9rem' }}>✅ 精准连接！</p>
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4 }}>角色正在过桥...</p>
            </div>
          )}

          {/* Completed summary */}
          {completedCount > 0 && (
            <div className="rounded-xl p-3 mt-auto"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#334155', fontSize: '0.7rem', marginBottom: 5 }}>已完成桥梁</p>
              <div className="flex flex-col gap-1">
                {zone.sites.map((site, i) => zs.siteStatuses[i] === 'completed' ? (
                  <p key={i} style={{ color: '#4ade80', fontSize: '0.73rem', fontFamily: 'monospace' }}>
                    ✓ 桥{i + 1}：{site.a}²+{site.b}²={site.a ** 2 + site.b ** 2} → c={site.c}m
                  </p>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
