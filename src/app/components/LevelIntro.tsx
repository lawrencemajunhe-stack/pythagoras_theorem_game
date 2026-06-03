import React from 'react';

interface Props { levelId: number; onStart: () => void; }

const DATA: Record<number, { title: string; subtitle: string; story: string; hint: string }> = {
  1: {
    title: '第一关',
    subtitle: '数字探索 · 单向通关',
    story: '你是一名见习数字建造师。眼前是失落的几何古城，平台悬空，前路断裂。你无法直视桥梁的长度，只能依靠古迹石碑上留下的水平距离（a）与高度（b）来选择正确的石料。一旦选错，桥梁便会坠落或崩塌。开工吧，用精准的计算连接未来！',
    hint: '注意观察直角三角形。古人发现，当两条直角边很短时，斜边也短；直角边变长，斜边也会变长。它们之间似乎存在着一种"平方和"的奇妙守恒。当你面对最基础的 3 米和 4 米缺口时，试着用它们的平方去寻找某种联系，那将是你通往下一关的钥匙。',
  },
  2: {
    title: '第二关',
    subtitle: '路径分叉 · 二选一',
    story: '前方出现了多条交错的悬空平台！仓库里的桥梁材料极为有限，这意味着有些看起来很近的路，可能会耗尽你的特定石料，最终让你陷入死胡同。在搭下第一座桥之前，你必须先规划好整条路线的物资分配。',
    hint: '你发现了吗？几何图形是可以"等比例放大"的。如果一个 3-4-5 的三角形被整体放大两倍，它的所有边都会按相同的倍数成长。当你看到成倍增长的直角边（a 和 b）时，不要害怕大数字，规律依然在按比例静静延伸。',
  },
  3: {
    title: '第三关',
    subtitle: '连续迷宫 · 干扰材料',
    story: '你已抵达古城的核心矩阵。这里的空间结构开始重叠，古老的迷雾甚至隐藏了部分平台的直接距离（未知数 a）。更棘手的是，材料仓库里被混入了迷惑性的废料，你再也无法通过"排除法"来猜出答案了。',
    hint: '过去，你总是通过两条直角边去寻找斜边。但别忘了，守恒是双向的。如果你已经通过背景的大蓝图知道了"整体的总高度"和"长斜边"，你是否能反过来用减法，剥离出那段被隐藏的未知跨度？公式的逆向思考，才是解开终极迷宫的密码。',
  },
};

export function LevelIntro({ levelId, onStart }: Props) {
  const d = DATA[levelId];
  if (!d) return null;
  const levelNum = String(levelId).padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 relative overflow-hidden"
      style={{ background: '#020b18' }}>

      {/* Blueprint grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.07 }}>
        <defs>
          <pattern id="intro-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#4db3ff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#intro-grid)" />
      </svg>

      {/* Glow accent */}
      <div className="absolute pointer-events-none" style={{
        top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse, rgba(20,80,180,0.18) 0%, transparent 70%)',
      }} />

      {/* Card */}
      <div className="relative w-full flex flex-col gap-0" style={{
        maxWidth: 640,
        background: 'rgba(3,12,27,0.92)',
        border: '1px solid rgba(20,80,180,0.4)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>

        {/* Card header bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #1e4a7a, #4db3ff, #1e4a7a)' }} />

        <div className="flex flex-col gap-5 p-6 pb-5">
          {/* Level badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{
              width: 44, height: 44, flexShrink: 0,
              background: 'rgba(20,80,180,0.18)',
              border: '1px solid rgba(20,80,180,0.45)',
            }}>
              <span style={{ color: '#4db3ff', fontFamily: 'monospace', fontSize: '0.8rem' }}>{levelNum}</span>
            </div>
            <div>
              <p style={{ color: '#4db3ff', fontFamily: 'monospace', fontSize: '0.65rem', letterSpacing: 2, lineHeight: 1 }}>LEVEL {levelNum}</p>
              <p style={{ color: '#e2e8f0', fontSize: '1.05rem', marginTop: 3, lineHeight: 1.2 }}>{d.title} · {d.subtitle}</p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(20,80,180,0.25)' }} />

          {/* Story section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span style={{ color: '#4db3ff', fontFamily: 'monospace', fontSize: '0.62rem', letterSpacing: 1.5 }}>◈ 背景介绍</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(20,80,180,0.25)' }} />
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.8 }}>{d.story}</p>
          </div>

          {/* Hint section */}
          <div className="flex flex-col gap-2 rounded-xl p-4" style={{
            background: 'rgba(255,196,0,0.04)',
            border: '1px solid rgba(255,196,0,0.18)',
          }}>
            <div className="flex items-center gap-2">
              <span style={{ color: '#ffc400', fontFamily: 'monospace', fontSize: '0.62rem', letterSpacing: 1.5 }}>◈ 建造师指南</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,196,0,0.2)' }} />
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.8 }}>{d.hint}</p>
          </div>

          {/* CTA */}
          <button
            onClick={onStart}
            className="w-full rounded-xl py-3.5 transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #c2410c, #ea580c)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              letterSpacing: 2,
              boxShadow: '0 4px 24px rgba(234,88,12,0.4)',
            }}>
            ▶▶ 开始挑战 / START
          </button>
        </div>

        {/* Bottom accent */}
        <div style={{ height: 1, background: 'rgba(20,80,180,0.25)' }} />
        <div className="px-6 py-2 flex justify-between">
          <span style={{ color: '#0d2a4a', fontFamily: 'monospace', fontSize: '0.6rem' }}>PYTHAGOREAN BRIDGE ENGINEER</span>
          <span style={{ color: '#0d2a4a', fontFamily: 'monospace', fontSize: '0.6rem' }}>勾股桥工程师</span>
        </div>
      </div>
    </div>
  );
}
