import React from 'react';

interface LevelProgress { wrong: number; done: boolean; }

interface Props {
  progress: Record<number, LevelProgress>;
  onSelectLevel: (n: number) => void;
}

const LEVELS = [
  {
    id: 1,
    title: '第一关',
    subtitle: '数字探索 · 单向通关',
    desc: '纯粹的单向路线，没有任何分支。观察水平距离与高差，从仓库中匹配正确的桥梁长度，建立直觉。',
    formula: 'a² + b² = ?',
    bridges: 3,
    triples: ['3-4-?', '6-8-?', '5-12-?'],
  },
  {
    id: 2,
    title: '第二关',
    subtitle: '路径分叉 · 二选一',
    desc: '出现了两条岔路！上方路线能建桥但会浪费关键材料——17m桥材只有一根，省着用才能到达终点。',
    formula: 'a² + b² = ?',
    bridges: 4,
    triples: ['6-8-?', '3-4-?', '5-12-?', '8-15-?'],
  },
  {
    id: 3,
    title: '第三关',
    subtitle: '连续迷宫 · 干扰材料',
    desc: '连续两次选路，仓库里混入了干扰材料！第二个岔口的距离被隐藏，需借助辅助参考线自行推算桥长。',
    formula: 'a² = c² - b²',
    bridges: 4,
    triples: ['0-9-?', '3-4-?', '?-0-12', '5-12-?'],
  },
];

export function GameHub({ progress, onSelectLevel }: Props) {
  const isUnlocked = (id: number) => id === 1 || !!(progress[id - 1]?.done);
  const stars = (id: number) => {
    const p = progress[id]; if (!p) return 0;
    return p.wrong === 0 ? 3 : p.wrong <= 2 ? 2 : 1;
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#020b18' }}>
      {/* Header */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4" style={{ borderBottom: '1px solid rgba(20,80,180,0.2)' }}>
        <div style={{ background: 'rgba(20,80,180,0.12)', border: '1px solid rgba(20,80,180,0.35)', borderRadius: 10, padding: '3px 14px', marginBottom: 16 }}>
          <span style={{ color: '#4db3ff', fontFamily: 'monospace', fontSize: '0.7rem', letterSpacing: 2 }}>PYTHAGOREAN BRIDGE ENGINEER</span>
        </div>
        <h1 style={{ color: '#e2e8f0', fontSize: '1.85rem', lineHeight: 1.2, textAlign: 'center', marginBottom: 8 }}>
          勾股桥工程师
        </h1>
        <p style={{ color: '#334155', fontSize: '0.82rem', textAlign: 'center' }}>
          通过建桥掌握勾股定理 · 三个渐进关卡
        </p>
        <div className="mt-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,196,0,0.07)', border: '1px solid rgba(255,196,0,0.2)' }}>
          <span style={{ color: '#ffc400', fontFamily: 'monospace', fontSize: '0.85rem' }}>a² + b² = ?</span>
        </div>
      </div>

      {/* Level cards */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-5 items-stretch justify-center" style={{ maxWidth: 920, margin: '0 auto', width: '100%' }}>
        {LEVELS.map(lv => {
          const unlocked = isUnlocked(lv.id);
          const done = !!(progress[lv.id]?.done);
          const st = stars(lv.id);
          const wrongCount = progress[lv.id]?.wrong ?? 0;
          return (
            <button
              key={lv.id}
              onClick={() => { if (unlocked) onSelectLevel(lv.id); }}
              disabled={!unlocked}
              className="flex-1 rounded-2xl p-5 text-left flex flex-col gap-3 transition-all active:scale-95"
              style={{
                cursor: unlocked ? 'pointer' : 'default',
                background: done ? 'rgba(0,230,118,0.05)' : unlocked ? 'rgba(20,80,180,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${done ? 'rgba(0,230,118,0.3)' : unlocked ? 'rgba(20,80,180,0.35)' : 'rgba(255,255,255,0.06)'}`,
                opacity: unlocked ? 1 : 0.4,
              }}>
              {/* Level number + lock */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: done ? 'rgba(0,230,118,0.15)' : unlocked ? 'rgba(20,80,180,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${done ? 'rgba(0,230,118,0.3)' : 'rgba(20,80,180,0.25)'}` }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: done ? '#00e676' : unlocked ? '#4db3ff' : '#334155' }}>
                      {unlocked ? String(lv.id).padStart(2, '0') : '🔒'}
                    </span>
                  </div>
                  <div>
                    <p style={{ color: done ? '#00e676' : unlocked ? '#4db3ff' : '#334155', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1 }}>LEVEL {lv.id}</p>
                    <p style={{ color: '#e2e8f0', fontSize: '0.95rem', marginTop: 2, lineHeight: 1.2 }}>{lv.title}</p>
                  </div>
                </div>
                {done && (
                  <div className="flex gap-0.5">
                    {[1,2,3].map(s => (
                      <span key={s} style={{ color: s <= st ? '#ffc400' : '#1e3a5f', fontSize: '1rem' }}>★</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitle */}
              <p style={{ color: '#4db3ff', fontSize: '0.75rem', fontFamily: 'monospace' }}>{lv.subtitle}</p>

              {/* Description */}
              <p style={{ color: '#475569', fontSize: '0.8rem', lineHeight: 1.6, flex: 1 }}>{lv.desc}</p>

              {/* Formula badge */}
              <div className="flex items-center gap-2">
                <div className="rounded-lg px-2 py-1" style={{ background: 'rgba(255,196,0,0.08)', border: '1px solid rgba(255,196,0,0.18)' }}>
                  <span style={{ color: '#ffc400', fontFamily: 'monospace', fontSize: '0.72rem' }}>{lv.formula}</span>
                </div>
                <span style={{ color: '#1e3a5f', fontSize: '0.7rem' }}>{lv.bridges} 座桥</span>
              </div>

              {/* Pythagorean triples */}
              <div className="flex gap-1.5 flex-wrap">
                {lv.triples.map(t => (
                  <span key={t} style={{ color: '#1e4a7a', fontFamily: 'monospace', fontSize: '0.65rem', background: 'rgba(20,80,180,0.12)', border: '1px solid rgba(20,80,180,0.2)', borderRadius: 5, padding: '1px 6px' }}>{t}</span>
                ))}
              </div>

              {/* Status footer */}
              <div style={{ borderTop: '1px solid rgba(20,80,180,0.18)', paddingTop: 10 }}>
                {done ? (
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#00e676', fontSize: '0.75rem' }}>✅ 已完成</span>
                    <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {wrongCount === 0 ? '零失误 🏆' : `错误 ${wrongCount} 次`}
                    </span>
                  </div>
                ) : unlocked ? (
                  <span style={{ color: '#4db3ff', fontSize: '0.75rem' }}>▶ 点击开始</span>
                ) : (
                  <span style={{ color: '#1e3a5f', fontSize: '0.75rem' }}>完成上一关解锁</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="py-4 text-center" style={{ borderTop: '1px solid rgba(20,80,180,0.15)' }}>
        <p style={{ color: '#0d2a4a', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          PYTHAGOREAN BRIDGE ENGINEER · 勾股桥工程师
        </p>
      </div>
    </div>
  );
}
