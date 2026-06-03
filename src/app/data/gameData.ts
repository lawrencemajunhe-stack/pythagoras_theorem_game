// ─── Types ────────────────────────────────────────────────────────
export interface ZoneSite {
  a: number;           // horizontal distance (game units)
  b: number;           // vertical height diff (game units, must match Δ platforms)
  c: number;           // correct bridge length = √(a²+b²)
  rightIsHigher: boolean;
  tolerance: number;
  hints: string[];
}

export interface InventoryItem {
  length: number;
  count: number;
}

export interface ZoneData {
  id: number;
  name: string;
  emoji: string;
  subtitle: string;
  description: string;
  difficulty: 1 | 2 | 3;
  scale: number;        // px per game unit
  baseY: number;        // pixel Y for gameY = 0
  platW: number;        // platform width in px
  platforms: number[];  // relative height (gameY) for each platform
  sites: ZoneSite[];
  initialInventory: InventoryItem[];
}

// ─── Zones ────────────────────────────────────────────────────────
// Layout verification:
//   Platform pixel Y = baseY - platforms[i] * scale
//   Gap pixel width  = sites[i].a * scale
//   Height diff check: |platforms[i+1] - platforms[i]| === sites[i].b  ✓

export const ZONES: ZoneData[] = [
  // ──────────────── ZONE 1: 翠谷 ─────────────────────────────────
  // Platforms: [0, +4, -4, +8]  height range = 12  scale = 17
  // BASE_Y = 242  platW = 60
  // P0 y=242  P1 y=174  P2 y=310  P3 y=106
  // Sites: A(3,4,5)  B(6,8,10)  C(5,12,13)
  {
    id: 1,
    name: "翠谷",
    emoji: "🌿",
    subtitle: "初入峡谷",
    description: "三处断崖，材料有限！每段桥的长度需要用勾股定理精确计算，用错了材料就会浪费！",
    difficulty: 1,
    scale: 17,
    baseY: 242,
    platW: 60,
    platforms: [0, 4, -4, 8],
    sites: [
      {
        a: 3, b: 4, c: 5,
        rightIsHigher: true, tolerance: 0.3,
        hints: [
          "水平距离 a = 3，垂直高度 b = 4",
          "3² + 4² = 9 + 16 = 25",
          "c = √25 = 5，选 5m 桥材！",
        ],
      },
      {
        a: 6, b: 8, c: 10,
        rightIsHigher: false, tolerance: 0.3,
        hints: [
          "注意是下坡！但 b = 8 照常参与计算",
          "6² + 8² = 36 + 64 = 100",
          "c = √100 = 10",
        ],
      },
      {
        a: 5, b: 12, c: 13,
        rightIsHigher: true, tolerance: 0.3,
        hints: [
          "全新比例，需要重新计算",
          "5² + 12² = 25 + 144 = 169",
          "c = √169 = 13",
        ],
      },
    ],
    initialInventory: [
      { length: 4, count: 1 },
      { length: 5, count: 2 },
      { length: 6, count: 1 },
      { length: 8, count: 1 },
      { length: 10, count: 2 },
      { length: 11, count: 1 },
      { length: 12, count: 1 },
      { length: 13, count: 2 },
      { length: 14, count: 1 },
    ],
  },

  // ──────────────── ZONE 2: 峰岭 ─────────────────────────────────
  // Platforms: [0, 12, 6, 21, 16]  height range = 21  scale = 8
  // BASE_Y = 292  platW = 60
  // P0 y=292  P1 y=196  P2 y=244  P3 y=124  P4 y=164
  // Sites: A(9,12,15)  B(8,6,10)  C(8,15,17)  D(12,5,13)
  {
    id: 2,
    name: "峰岭",
    emoji: "⛰️",
    subtitle: "险峻山岭",
    description: "四处峭壁需要修复，数字变大了！注意上坡和下坡都需要相同的公式。",
    difficulty: 2,
    scale: 8,
    baseY: 292,
    platW: 60,
    platforms: [0, 12, 6, 21, 16],
    sites: [
      {
        a: 9, b: 12, c: 15,
        rightIsHigher: true, tolerance: 0.3,
        hints: [
          "9² + 12² = ?",
          "81 + 144 = 225",
          "c = √225 = 15",
        ],
      },
      {
        a: 8, b: 6, c: 10,
        rightIsHigher: false, tolerance: 0.3,
        hints: [
          "下坡！b = 6，a = 8",
          "8² + 6² = 64 + 36 = 100",
          "c = √100 = 10",
        ],
      },
      {
        a: 8, b: 15, c: 17,
        rightIsHigher: true, tolerance: 0.3,
        hints: [
          "8² + 15² = ?",
          "64 + 225 = 289",
          "c = √289 = 17",
        ],
      },
      {
        a: 12, b: 5, c: 13,
        rightIsHigher: false, tolerance: 0.3,
        hints: [
          "5-12-13 的变种（a 和 b 互换）",
          "12² + 5² = 144 + 25 = 169",
          "c = √169 = 13",
        ],
      },
    ],
    initialInventory: [
      { length: 8, count: 1 },
      { length: 10, count: 2 },
      { length: 12, count: 1 },
      { length: 13, count: 2 },
      { length: 14, count: 1 },
      { length: 15, count: 2 },
      { length: 16, count: 1 },
      { length: 17, count: 2 },
      { length: 20, count: 1 },
    ],
  },

  // ──────────────── ZONE 3: 天险 ─────────────────────────────────
  // Platforms: [0, 15, -9, 12, 0]  height range = 24  scale = 7
  // BASE_Y = 230  platW = 60
  // P0 y=230  P1 y=125  P2 y=293  P3 y=146  P4 y=230
  // Sites: A(8,15,17)  B(7,24,25)  C(20,21,29)  D(9,12,15)
  {
    id: 3,
    name: "天险",
    emoji: "🏔️",
    subtitle: "绝壁天险",
    description: "四处绝壁天险，数字更大！只有精准计算才能选对材料，用错就是浪费！",
    difficulty: 3,
    scale: 7,
    baseY: 230,
    platW: 60,
    platforms: [0, 15, -9, 12, 0],
    sites: [
      {
        a: 8, b: 15, c: 17,
        rightIsHigher: true, tolerance: 0.4,
        hints: [
          "8² + 15² = ?",
          "64 + 225 = 289",
          "c = √289 = 17",
        ],
      },
      {
        a: 7, b: 24, c: 25,
        rightIsHigher: false, tolerance: 0.4,
        hints: [
          "7² + 24² = ?",
          "49 + 576 = 625",
          "c = √625 = 25",
        ],
      },
      {
        a: 20, b: 21, c: 29,
        rightIsHigher: true, tolerance: 0.5,
        hints: [
          "20² + 21² = ?",
          "400 + 441 = 841",
          "c = √841 = 29",
        ],
      },
      {
        a: 9, b: 12, c: 15,
        rightIsHigher: false, tolerance: 0.3,
        hints: [
          "认识这组数吗？3-4-5 的 3 倍！",
          "9² + 12² = 81 + 144 = 225",
          "c = √225 = 15",
        ],
      },
    ],
    initialInventory: [
      { length: 15, count: 2 },
      { length: 17, count: 2 },
      { length: 20, count: 1 },
      { length: 24, count: 1 },
      { length: 25, count: 2 },
      { length: 26, count: 1 },
      { length: 29, count: 2 },
      { length: 30, count: 1 },
    ],
  },
];
