import type { GameModeId, MapId, MapObstacle, TeamId } from '../shared/gameData.ts';
import { areActorsAllied } from './domainLogic.ts';

export type TerrainZoneKind = 'water' | 'lava' | 'grass' | 'steam';

export interface TerrainZoneSpec {
  id: string;
  mapId: MapId;
  kind: TerrainZoneKind;
  shape: 'circle' | 'rect';
  x: number;
  z: number;
  radius?: number;
  halfW?: number;
  halfD?: number;
  floorOffsetY?: number;
}

export type BuildingStyle =
  | 'store'
  | 'ramen'
  | 'subway'
  | 'forge'
  | 'volcano'
  | 'dojo'
  | 'pavilion'
  | 'coliseum'
  | 'catacomb';

export interface EnterableBuildingSpec {
  id: string;
  mapId: MapId;
  name: string;
  style: BuildingStyle;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  wallHeight: number;
  roofY: number;
  floorColorHex: number;
  wallColorHex: number;
  roofColorHex: number;
  accentColorHex: number;
  doorSides: Array<'n' | 's' | 'e' | 'w'>;
  maxHp?: number;
  isSubterranean?: boolean;
  subterraneanDepth?: number;
}

export interface DynamicHazardPatch {
  id: string;
  kind: 'lava' | 'water';
  x: number;
  z: number;
  radius: number;
}

export interface FrozenWaterCircle {
  x: number;
  z: number;
  radius: number;
}

export const OPEN_CENTER_CLEAR_RADIUS = 11.5;

export const TEMPLE_NPC_SPAWN = {
  x: 0,
  z: -17.5,
  rotY: 0,
};

export function rollTempleNpcSpawn(rng: () => number = Math.random): boolean {
  return rng() < 0.5;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smooth rectangular plateau/basin falloff: returns 1 inside [halfW, halfD], tapering smoothly
 * down to 0 over `rampWidth` meters so fighters can smoothly run up & down terrain ramps.
 */
function rectRampFactor(
  x: number,
  z: number,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rampWidth: number
): number {
  const dx = Math.max(0, Math.abs(x - cx) - halfW);
  const dz = Math.max(0, Math.abs(z - cz) - halfD);
  const dist = Math.hypot(dx, dz);
  return 1 - smoothstep(0, rampWidth, dist);
}

function circleRampFactor(
  x: number,
  z: number,
  cx: number,
  cz: number,
  innerR: number,
  rampWidth: number
): number {
  const d = Math.hypot(x - cx, z - cz);
  return 1 - smoothstep(innerR, innerR + rampWidth, d);
}

/**
 * All terrain hazards, water basins, and tall stealth zones sit strictly outside
 * the 11.5m open central duel ring so center-stage combat remains unobstructed.
 */
export const MAP_TERRAIN_ZONES: Record<MapId, TerrainZoneSpec[]> = {
  shibuya: [
    {
      id: 'shib-water-west',
      mapId: 'shibuya',
      kind: 'water',
      shape: 'rect',
      x: -18.5,
      z: 11.5,
      halfW: 6.4,
      halfD: 2.6,
      floorOffsetY: -0.22,
    },
    {
      id: 'shib-water-east',
      mapId: 'shibuya',
      kind: 'water',
      shape: 'circle',
      x: 17.5,
      z: 11.5,
      radius: 4.2,
      floorOffsetY: -0.2,
    },
    {
      id: 'shib-steam-nw',
      mapId: 'shibuya',
      kind: 'steam',
      shape: 'circle',
      x: -8.0,
      z: -16.5,
      radius: 3.1,
    },
    {
      id: 'shib-steam-se',
      mapId: 'shibuya',
      kind: 'steam',
      shape: 'circle',
      x: 8.5,
      z: 16.5,
      radius: 3.1,
    },
    {
      id: 'shib-steam-w',
      mapId: 'shibuya',
      kind: 'steam',
      shape: 'circle',
      x: -24.5,
      z: -2.0,
      radius: 2.9,
    },
  ],
  obsidian: [
    // Outer magma channels & pools (clear of center r < 11.5m)
    {
      id: 'obs-lava-ne',
      mapId: 'obsidian',
      kind: 'lava',
      shape: 'rect',
      x: 16.5,
      z: -14.5,
      halfW: 5.8,
      halfD: 2.5,
      floorOffsetY: -0.34,
    },
    {
      id: 'obs-lava-sw',
      mapId: 'obsidian',
      kind: 'lava',
      shape: 'rect',
      x: -16.5,
      z: 14.5,
      halfW: 5.8,
      halfD: 2.5,
      floorOffsetY: -0.34,
    },
    {
      id: 'obs-lava-east',
      mapId: 'obsidian',
      kind: 'lava',
      shape: 'circle',
      x: 24.5,
      z: 0,
      radius: 3.6,
      floorOffsetY: -0.32,
    },
    // Volcanic steam vents for stealth ambushes
    {
      id: 'obs-steam-w',
      mapId: 'obsidian',
      kind: 'steam',
      shape: 'circle',
      x: -22.5,
      z: 3.5,
      radius: 3.1,
    },
    {
      id: 'obs-steam-n',
      mapId: 'obsidian',
      kind: 'steam',
      shape: 'circle',
      x: 3.5,
      z: -22.5,
      radius: 3.0,
    },
  ],
  temple: [
    // Outer tranquil koi ponds (spanned by arched pagoda bridges)
    {
      id: 'temp-koi-west',
      mapId: 'temple',
      kind: 'water',
      shape: 'circle',
      x: -17.5,
      z: 5.5,
      radius: 5.0,
      floorOffsetY: -0.26,
    },
    {
      id: 'temp-koi-east',
      mapId: 'temple',
      kind: 'water',
      shape: 'circle',
      x: 17.5,
      z: -5.5,
      radius: 5.0,
      floorOffsetY: -0.26,
    },
    // Dense outer bamboo stealth thickets
    {
      id: 'temp-bamboo-nw',
      mapId: 'temple',
      kind: 'grass',
      shape: 'circle',
      x: -7.5,
      z: -18.5,
      radius: 3.2,
    },
    {
      id: 'temp-bamboo-se',
      mapId: 'temple',
      kind: 'grass',
      shape: 'circle',
      x: 7.5,
      z: 18.5,
      radius: 3.2,
    },
    {
      id: 'temp-bamboo-sw',
      mapId: 'temple',
      kind: 'grass',
      shape: 'circle',
      x: -19.5,
      z: 17.5,
      radius: 3.2,
    },
    {
      id: 'temp-bamboo-ne',
      mapId: 'temple',
      kind: 'grass',
      shape: 'circle',
      x: 19.5,
      z: -17.5,
      radius: 3.2,
    },
  ],
  meadow: [
    // Outer golden oasis pools (spanned by causeway bridges)
    {
      id: 'mead-oasis-w',
      mapId: 'meadow',
      kind: 'water',
      shape: 'circle',
      x: -17.5,
      z: 5.5,
      radius: 4.8,
      floorOffsetY: -0.28,
    },
    {
      id: 'mead-oasis-e',
      mapId: 'meadow',
      kind: 'water',
      shape: 'circle',
      x: 17.5,
      z: -5.5,
      radius: 4.8,
      floorOffsetY: -0.28,
    },
    // Tall oasis reed grass patches (stealth!)
    {
      id: 'mead-grass-n',
      mapId: 'meadow',
      kind: 'grass',
      shape: 'circle',
      x: -4.5,
      z: -18.5,
      radius: 3.2,
    },
    {
      id: 'mead-grass-s',
      mapId: 'meadow',
      kind: 'grass',
      shape: 'circle',
      x: 4.5,
      z: 18.5,
      radius: 3.2,
    },
    {
      id: 'mead-grass-sw',
      mapId: 'meadow',
      kind: 'grass',
      shape: 'circle',
      x: -20.5,
      z: 14.5,
      radius: 3.1,
    },
    {
      id: 'mead-grass-ne',
      mapId: 'meadow',
      kind: 'grass',
      shape: 'circle',
      x: 20.5,
      z: -14.5,
      radius: 3.1,
    },
  ],
};

export const MAP_ENTERABLE_BUILDINGS: Record<MapId, EnterableBuildingSpec[]> = {
  shibuya: [
    {
      id: 'shib-mart-nw',
      mapId: 'shibuya',
      name: '24H KONBINI',
      style: 'store',
      x: -17.5,
      z: -16.5,
      halfW: 3.5,
      halfD: 3.0,
      wallHeight: 3.6,
      roofY: 3.8,
      floorColorHex: 0xe2e8f0,
      wallColorHex: 0xf8fafc,
      roofColorHex: 0x0284c7,
      accentColorHex: 0x38bdf8,
      doorSides: ['s', 'e'],
      maxHp: 115,
    },
    {
      id: 'shib-ramen-ne',
      mapId: 'shibuya',
      name: 'NEO RAMEN',
      style: 'ramen',
      x: 17.5,
      z: -16.5,
      halfW: 3.5,
      halfD: 3.0,
      wallHeight: 3.6,
      roofY: 3.8,
      floorColorHex: 0xfef3c7,
      wallColorHex: 0x334155,
      roofColorHex: 0xe11d48,
      accentColorHex: 0xfb7185,
      doorSides: ['s', 'w'],
      maxHp: 115,
    },
    {
      id: 'shib-metro-s',
      mapId: 'shibuya',
      name: 'METRO CONCOURSE',
      style: 'subway',
      x: 0,
      z: 22.0,
      halfW: 4.2,
      halfD: 2.8,
      wallHeight: 3.5,
      roofY: 3.7,
      floorColorHex: 0xcbd5e1,
      wallColorHex: 0x475569,
      roofColorHex: 0x0f172a,
      accentColorHex: 0x22d3ee,
      doorSides: ['n', 'e', 'w'],
      maxHp: 125,
    },
  ],
  obsidian: [
    {
      id: 'obs-volcano-nw',
      mapId: 'obsidian',
      name: 'CORNER VOLCANO CALDERA',
      style: 'volcano',
      x: -19.5,
      z: -18.5,
      halfW: 4.8,
      halfD: 4.4,
      wallHeight: 4.4,
      roofY: 4.6,
      floorColorHex: 0x1c1917,
      wallColorHex: 0x292524,
      roofColorHex: 0x0f172a,
      accentColorHex: 0xf97316,
      doorSides: ['s', 'e'],
      maxHp: 220,
    },
    {
      id: 'obs-forge-se',
      mapId: 'obsidian',
      name: 'MAGMA KEEP SE',
      style: 'forge',
      x: 19.5,
      z: 18.5,
      halfW: 3.6,
      halfD: 3.2,
      wallHeight: 3.7,
      roofY: 3.9,
      floorColorHex: 0x1e293b,
      wallColorHex: 0x334155,
      roofColorHex: 0x0f172a,
      accentColorHex: 0xa855f7,
      doorSides: ['n', 'w'],
      maxHp: 140,
    },
  ],
  temple: [
    {
      id: 'temp-dojo-nw',
      mapId: 'temple',
      name: 'BAMBOO DOJO',
      style: 'dojo',
      x: -18.5,
      z: -16.5,
      halfW: 3.6,
      halfD: 3.1,
      wallHeight: 3.6,
      roofY: 3.9,
      floorColorHex: 0x854d0e,
      wallColorHex: 0x7f1d1d,
      roofColorHex: 0x1e293b,
      accentColorHex: 0xfb923c,
      doorSides: ['s', 'e'],
      maxHp: 120,
    },
    {
      id: 'temp-pav-se',
      mapId: 'temple',
      name: 'LOTUS PAVILION',
      style: 'pavilion',
      x: 18.5,
      z: 16.5,
      halfW: 3.6,
      halfD: 3.1,
      wallHeight: 3.6,
      roofY: 3.9,
      floorColorHex: 0xa16207,
      wallColorHex: 0x991b1b,
      roofColorHex: 0x1e293b,
      accentColorHex: 0xfacc15,
      doorSides: ['n', 'w'],
      maxHp: 120,
    },
  ],
  meadow: [
    {
      id: 'mead-coliseum-nw',
      mapId: 'meadow',
      name: 'ANCIENT COLISEUM',
      style: 'coliseum',
      x: -19.5,
      z: -18.0,
      halfW: 4.8,
      halfD: 4.3,
      wallHeight: 4.2,
      roofY: 4.4,
      floorColorHex: 0xe7d6b5,
      wallColorHex: 0xe7e5e4,
      roofColorHex: 0xd97706,
      accentColorHex: 0xfacc15,
      doorSides: ['s', 'e'],
      maxHp: 190,
    },
    {
      id: 'mead-catacomb-se',
      mapId: 'meadow',
      name: 'UNDERGROUND CATACOMBS',
      style: 'catacomb',
      x: 19.5,
      z: 18.5,
      halfW: 4.3,
      halfD: 3.9,
      wallHeight: 3.65,
      roofY: 3.65,
      floorColorHex: 0x475569,
      wallColorHex: 0x64748b,
      roofColorHex: 0xb45309,
      accentColorHex: 0x38bdf8,
      doorSides: ['n', 'w'],
      maxHp: 220,
      isSubterranean: true,
      subterraneanDepth: 3.4,
    },
  ],
};

/**
 * Generates perimeter destructible walls for each enterable building while leaving
 * generous 2.8m+ open doorways on `doorSides` so fighters & bots walk straight inside.
 */
export function buildEnterableBuildingWallObstacles(mapId: MapId): MapObstacle[] {
  const buildings = MAP_ENTERABLE_BUILDINGS[mapId] ?? [];
  const walls: MapObstacle[] = [];
  const wallThick = 0.36;

  for (const b of buildings) {
    const maxHp = b.maxHp ?? 110;
    const h = b.wallHeight;
    const doorHalfGap = b.style === 'volcano' || b.style === 'coliseum' || b.isSubterranean ? 1.55 : 1.32;
    const indestructibleSub = Boolean(b.isSubterranean);

    const addHorizontalWall = (side: 'n' | 's', zCenter: number) => {
      const hasDoor = b.doorSides.includes(side);
      if (!hasDoor) {
        walls.push({
          id: `${b.id}-w-${side}`,
          kind: 'wall',
          variant: 'buildingWall',
          x: b.x,
          z: zCenter,
          halfW: b.halfW,
          halfD: wallThick,
          topY: h,
          colorHex: b.wallColorHex,
          roofColorHex: b.accentColorHex,
          destructible: !indestructibleSub,
          maxHp,
        });
      } else {
        const segW = Math.max(0.55, (b.halfW - doorHalfGap) * 0.5);
        const offset = doorHalfGap + segW;
        if (b.halfW - doorHalfGap > 0.65) {
          walls.push(
            {
              id: `${b.id}-w-${side}l`,
              kind: 'wall',
              variant: 'buildingWall',
              x: b.x - offset,
              z: zCenter,
              halfW: segW,
              halfD: wallThick,
              topY: h,
              colorHex: b.wallColorHex,
              roofColorHex: b.accentColorHex,
              destructible: !indestructibleSub,
              maxHp: Math.round(maxHp * 0.75),
            },
            {
              id: `${b.id}-w-${side}r`,
              kind: 'wall',
              variant: 'buildingWall',
              x: b.x + offset,
              z: zCenter,
              halfW: segW,
              halfD: wallThick,
              topY: h,
              colorHex: b.wallColorHex,
              roofColorHex: b.accentColorHex,
              destructible: !indestructibleSub,
              maxHp: Math.round(maxHp * 0.75),
            }
          );
        }
      }
    };

    const addVerticalWall = (side: 'w' | 'e', xCenter: number) => {
      const hasDoor = b.doorSides.includes(side);
      if (!hasDoor) {
        walls.push({
          id: `${b.id}-w-${side}`,
          kind: 'wall',
          variant: 'buildingWall',
          x: xCenter,
          z: b.z,
          halfW: wallThick,
          halfD: b.halfD - wallThick * 1.4,
          topY: h,
          colorHex: b.wallColorHex,
          roofColorHex: b.accentColorHex,
          destructible: !indestructibleSub,
          maxHp,
        });
      } else {
        const usableHalfD = Math.max(0.5, b.halfD - wallThick * 1.4);
        const segD = Math.max(0.45, (usableHalfD - doorHalfGap) * 0.5);
        const offset = doorHalfGap + segD;
        if (usableHalfD - doorHalfGap > 0.55) {
          walls.push(
            {
              id: `${b.id}-w-${side}t`,
              kind: 'wall',
              variant: 'buildingWall',
              x: xCenter,
              z: b.z - offset,
              halfW: wallThick,
              halfD: segD,
              topY: h,
              colorHex: b.wallColorHex,
              roofColorHex: b.accentColorHex,
              destructible: !indestructibleSub,
              maxHp: Math.round(maxHp * 0.75),
            },
            {
              id: `${b.id}-w-${side}b`,
              kind: 'wall',
              variant: 'buildingWall',
              x: xCenter,
              z: b.z + offset,
              halfW: wallThick,
              halfD: segD,
              topY: h,
              colorHex: b.wallColorHex,
              roofColorHex: b.accentColorHex,
              destructible: !indestructibleSub,
              maxHp: Math.round(maxHp * 0.75),
            }
          );
        }
      }
    };

    addHorizontalWall('n', b.z - b.halfD);
    addHorizontalWall('s', b.z + b.halfD);
    addVerticalWall('w', b.x - b.halfW);
    addVerticalWall('e', b.x + b.halfW);
  }

  return walls;
}

/**
 * Computes sculpted multi-layered terrain elevation (plateaus, ramps, sunken basins, bridges,
 * and the Underground Catacombs chamber on meadow) continuously at any (x, z) so physics,
 * camera, aim holograms, and 3D terrain geometry stay 100% aligned.
 * Center r < 11.5m remains clean level ground (y = 0) across all maps.
 */
export function computeMapTerrainHeight(
  mapId: MapId,
  x: number,
  z: number,
  arenaRadius: number
): number {
  let y = 0;

  if (mapId === 'shibuya') {
    const northPlaza = rectRampFactor(x, z, 0, -22.0, 20, 4.0, 4.2) * 0.62;
    const southMetro = rectRampFactor(x, z, 0, 22.5, 16, 3.8, 4.0) * 0.58;
    const nwPad = rectRampFactor(x, z, -17.5, -16.5, 4.5, 3.8, 3.2) * 0.34;
    const nePad = rectRampFactor(x, z, 17.5, -16.5, 4.5, 3.8, 3.2) * 0.34;
    const westDip = rectRampFactor(x, z, -18.5, 11.5, 5.4, 1.9, 2.0) * -0.22;
    const eastDip = circleRampFactor(x, z, 17.5, 11.5, 3.0, 2.0) * -0.2;
    y = Math.max(northPlaza, southMetro, nwPad, nePad) + westDip + eastDip;
  } else if (mapId === 'obsidian') {
    const volcanoPad = rectRampFactor(x, z, -19.5, -18.5, 5.4, 5.0, 4.4) * 0.85;
    const keepPad = rectRampFactor(x, z, 19.5, 18.5, 4.6, 4.2, 4.0) * 0.82;
    const northRidge = circleRampFactor(x, z, 3.5, -22.5, 4.8, 4.4) * 0.78;
    const southRidge = circleRampFactor(x, z, -3.5, 22.5, 4.8, 4.4) * 0.78;
    const lavaNeDip = rectRampFactor(x, z, 16.5, -14.5, 4.8, 1.7, 1.9) * -0.34;
    const lavaSwDip = rectRampFactor(x, z, -16.5, 14.5, 4.8, 1.7, 1.9) * -0.34;
    const lavaEastDip = circleRampFactor(x, z, 24.5, 0, 2.6, 1.8) * -0.32;
    const bridgeNe = rectRampFactor(x, z, 16.5, -14.5, 1.5, 3.4, 0.9) * 0.42;
    const bridgeSw = rectRampFactor(x, z, -16.5, 14.5, 1.5, 3.4, 0.9) * 0.42;
    y =
      Math.max(volcanoPad, keepPad, northRidge, southRidge) +
      lavaNeDip +
      lavaSwDip +
      lavaEastDip;
    y = Math.max(y, bridgeNe, bridgeSw);
  } else if (mapId === 'temple') {
    const shrineTerrace = rectRampFactor(x, z, 0, -22.5, 16, 4.0, 4.2) * 0.9;
    const dojoPad = rectRampFactor(x, z, -18.5, -16.5, 4.5, 3.8, 3.6) * 0.56;
    const pavPad = rectRampFactor(x, z, 18.5, 16.5, 4.5, 3.8, 3.6) * 0.56;
    const pondW = circleRampFactor(x, z, -17.5, 5.5, 3.9, 1.9) * -0.26;
    const pondE = circleRampFactor(x, z, 17.5, -5.5, 3.9, 1.9) * -0.26;
    const bridgeW = rectRampFactor(x, z, -17.5, 5.5, 5.4, 1.25, 0.9) * 0.52;
    const bridgeE = rectRampFactor(x, z, 17.5, -5.5, 5.4, 1.25, 0.9) * 0.52;
    y = Math.max(shrineTerrace, dojoPad, pavPad) + pondW + pondE;
    y = Math.max(y, bridgeW, bridgeE);
  } else {
    // meadow -> Ancient Coliseum (NW) + Underground Catacombs (SE, down to -3.4m) + Oasis pools
    const northBattlement = rectRampFactor(x, z, 0, -22.5, 15, 3.8, 4.2) * 0.88;
    const southBattlement = rectRampFactor(x, z, 0, 22.5, 15, 3.8, 4.2) * 0.88;
    const coliseumPad = rectRampFactor(x, z, -19.5, -18.0, 5.4, 4.8, 4.0) * 0.55;
    // Underground Catacombs chamber (SE corner): smoothly dips -3.4m with wide stone stair ramps from N & W
    const catacombChamber = rectRampFactor(x, z, 19.5, 18.5, 4.5, 4.1, 4.2) * -3.4;
    const catacombEntryRamp = rectRampFactor(x, z, 15.2, 14.5, 2.2, 2.2, 3.6) * -1.45;
    const oasisW = circleRampFactor(x, z, -17.5, 5.5, 3.7, 1.9) * -0.28;
    const oasisE = circleRampFactor(x, z, 17.5, -5.5, 3.7, 1.9) * -0.28;
    const causewayW = rectRampFactor(x, z, -17.5, 5.5, 5.1, 1.2, 0.9) * 0.34;
    const causewayE = rectRampFactor(x, z, 17.5, -5.5, 5.1, 1.2, 0.9) * 0.34;

    const sunkenCatacomb = Math.min(catacombChamber, catacombEntryRamp);
    const positiveRise = Math.max(northBattlement, southBattlement, coliseumPad);
    y = sunkenCatacomb < -0.15 ? sunkenCatacomb : Math.max(positiveRise + oasisW + oasisE, causewayW, causewayE);
  }

  const r = Math.hypot(x, z);
  if (r > arenaRadius + 1.8) {
    const outer = r - (arenaRadius + 1.8);
    if (mapId === 'shibuya') {
      y += outer * 0.055;
    } else if (mapId === 'meadow') {
      y += outer * 0.15 + Math.sin(x * 0.12) * Math.cos(z * 0.12) * 0.24;
    } else if (mapId === 'temple') {
      y += outer * 0.12;
    } else {
      y += outer * 0.18 + Math.sin(x * 0.14) * Math.cos(z * 0.14) * 0.18;
    }
  }

  return y;
}

export function pointInTerrainZone(zone: TerrainZoneSpec, x: number, z: number): boolean {
  if (zone.shape === 'circle') {
    const r = zone.radius ?? 3.0;
    const dx = x - zone.x;
    const dz = z - zone.z;
    return dx * dx + dz * dz <= r * r;
  }
  const hw = zone.halfW ?? 3.0;
  const hd = zone.halfD ?? 3.0;
  return Math.abs(x - zone.x) <= hw && Math.abs(z - zone.z) <= hd;
}

export function findEnterableBuildingAt(
  mapId: MapId,
  x: number,
  relY: number,
  z: number
): EnterableBuildingSpec | null {
  const buildings = MAP_ENTERABLE_BUILDINGS[mapId] ?? [];
  for (const b of buildings) {
    if (relY > b.roofY - 0.35) continue;
    if (Math.abs(x - b.x) <= b.halfW + 0.35 && Math.abs(z - b.z) <= b.halfD + 0.35) {
      return b;
    }
  }
  return null;
}

export interface EvaluatedTerrainState {
  inWater: boolean;
  onIce: boolean;
  inLava: boolean;
  inStealth: boolean;
  stealthPatchId: string | null;
  insideBuildingId: string | null;
  speedMultiplier: number;
  lightningBoost: number;
}

/**
 * Evaluates water, frozen-ice water, lava, tall-grass/steam stealth, and enterable building occupancy.
 */
export function evaluateTerrainZonesAt(
  mapId: MapId,
  x: number,
  relY: number,
  z: number,
  dynamicPatches?: DynamicHazardPatch[],
  frozenWaterZones?: FrozenWaterCircle[]
): EvaluatedTerrainState {
  const zones = MAP_TERRAIN_ZONES[mapId] ?? [];
  const nearGround = relY <= 0.85;
  let inWater = false;
  let onIce = false;
  let inLava = false;
  let inStealth = false;
  let stealthPatchId: string | null = null;

  const isFrozenAt = (px: number, pz: number): boolean => {
    if (!frozenWaterZones || frozenWaterZones.length === 0) return false;
    for (const fz of frozenWaterZones) {
      const dx = px - fz.x;
      const dz = pz - fz.z;
      if (dx * dx + dz * dz <= fz.radius * fz.radius) return true;
    }
    return false;
  };

  if (nearGround) {
    const onDryBridge =
      (mapId === 'temple' &&
        (rectRampFactor(x, z, -17.5, 5.5, 5.1, 1.1, 0.3) > 0.5 ||
          rectRampFactor(x, z, 17.5, -5.5, 5.1, 1.1, 0.3) > 0.5)) ||
      (mapId === 'meadow' &&
        (rectRampFactor(x, z, -17.5, 5.5, 4.9, 1.05, 0.3) > 0.5 ||
          rectRampFactor(x, z, 17.5, -5.5, 4.9, 1.05, 0.3) > 0.5)) ||
      (mapId === 'obsidian' &&
        relY >= 0.35 &&
        (rectRampFactor(x, z, 16.5, -14.5, 1.4, 3.2, 0.3) > 0.5 ||
          rectRampFactor(x, z, -16.5, 14.5, 1.4, 3.2, 0.3) > 0.5));

    for (const zone of zones) {
      if (!pointInTerrainZone(zone, x, z)) continue;
      if (zone.kind === 'water' && !onDryBridge) {
        if (isFrozenAt(x, z)) {
          onIce = true;
        } else {
          inWater = true;
        }
      } else if (zone.kind === 'lava' && !onDryBridge) {
        inLava = true;
      } else if (zone.kind === 'grass' || zone.kind === 'steam') {
        inStealth = true;
        stealthPatchId = zone.id;
      }
    }

    if (dynamicPatches) {
      for (const p of dynamicPatches) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (dx * dx + dz * dz <= p.radius * p.radius) {
          if (p.kind === 'lava') inLava = true;
          if (p.kind === 'water') {
            if (isFrozenAt(x, z)) {
              onIce = true;
            } else {
              inWater = true;
            }
          }
        }
      }
    }
  }

  const building = findEnterableBuildingAt(mapId, x, relY, z);

  return {
    inWater,
    onIce,
    inLava,
    inStealth,
    stealthPatchId,
    insideBuildingId: building?.id ?? null,
    speedMultiplier: onIce ? 1.08 : inWater ? 0.7 : 1.0,
    lightningBoost: inWater ? 1.25 : 1.0,
  };
}

export interface StealthVisibilityActor {
  playerId: string;
  x: number;
  z: number;
  team?: TeamId;
  isKO: boolean;
  stealthed?: boolean;
  stealthPatchId?: string | null;
}

export function shouldViewerSeeActor(
  target: StealthVisibilityActor,
  viewer: StealthVisibilityActor | undefined,
  gameMode: GameModeId = 'classic'
): boolean {
  if (!target.stealthed || target.isKO) return true;
  if (!viewer || viewer.playerId === target.playerId) return true;
  if (areActorsAllied(viewer, target, gameMode)) return true;
  if (viewer.stealthPatchId && target.stealthPatchId && viewer.stealthPatchId === target.stealthPatchId) {
    return true;
  }
  const distSq = (viewer.x - target.x) * (viewer.x - target.x) + (viewer.z - target.z) * (viewer.z - target.z);
  return distSq <= 2.6 * 2.6;
}

export interface TacticalOrbCandidate {
  x: number;
  z: number;
  tag: 'building' | 'high_ground' | 'alley' | 'hazard_edge';
}

export const MAP_TACTICAL_ORB_CANDIDATES: Record<MapId, TacticalOrbCandidate[]> = {
  shibuya: [
    { x: -17.5, z: -16.5, tag: 'building' },
    { x: 17.5, z: -16.5, tag: 'building' },
    { x: 0, z: 22.0, tag: 'building' },
    { x: 0, z: -22.0, tag: 'high_ground' },
    { x: -24.5, z: 2.0, tag: 'alley' },
    { x: 24.5, z: -2.0, tag: 'alley' },
    { x: -18.5, z: 11.5, tag: 'hazard_edge' },
    { x: 17.5, z: 11.5, tag: 'hazard_edge' },
  ],
  obsidian: [
    { x: -19.5, z: -18.5, tag: 'building' }, // Corner Volcano interior
    { x: 19.5, z: 18.5, tag: 'building' },   // Magma Keep SE
    { x: 3.5, z: -22.5, tag: 'high_ground' },
    { x: -3.5, z: 22.5, tag: 'high_ground' },
    { x: 16.5, z: -14.5, tag: 'high_ground' }, // Basalt bridge NE
    { x: -16.5, z: 14.5, tag: 'high_ground' }, // Basalt bridge SW
    { x: -22.5, z: 3.5, tag: 'alley' },
    { x: 24.5, z: -4.0, tag: 'hazard_edge' },
  ],
  temple: [
    { x: -18.5, z: -16.5, tag: 'building' },
    { x: 18.5, z: 16.5, tag: 'building' },
    { x: 0, z: -22.5, tag: 'high_ground' },
    { x: -17.5, z: 5.5, tag: 'high_ground' }, // Atop West Pagoda Bridge
    { x: 17.5, z: -5.5, tag: 'high_ground' }, // Atop East Pagoda Bridge
    { x: 19.5, z: -17.5, tag: 'alley' },
    { x: -19.5, z: 17.5, tag: 'alley' },
    { x: 0, z: 22.0, tag: 'alley' },
  ],
  meadow: [
    { x: -19.5, z: -18.0, tag: 'building' }, // Corner Coliseum
    { x: 19.5, z: 18.5, tag: 'building' },   // Underground Catacombs
    { x: 0, z: -22.5, tag: 'high_ground' },
    { x: 0, z: 22.5, tag: 'high_ground' },
    { x: -17.5, z: 5.5, tag: 'high_ground' }, // Atop Oasis Causeway
    { x: 17.5, z: -5.5, tag: 'high_ground' },
    { x: 20.5, z: -14.5, tag: 'alley' },
    { x: -20.5, z: 14.5, tag: 'alley' },
  ],
};

/**
 * Computes exact surface height (terrain height + top surface of any walkable platform/bridge)
 * so aim holograms conform seamlessly over slopes, bridges, stairs, and platforms.
 */
export function getSurfaceHeightAt(
  mapId: MapId,
  x: number,
  z: number,
  arenaRadius: number,
  obstacles?: Array<MapObstacle & { destroyed?: boolean }>,
  casterRelY = 0
): number {
  const terrainY = computeMapTerrainHeight(mapId, x, z, arenaRadius);
  let extraY = 0;
  if (obstacles && obstacles.length > 0) {
    const reachTop = Math.max(2.1, casterRelY + 1.8);
    for (const obs of obstacles) {
      if (obs.destroyed) continue;
      if (obs.topY > reachTop) continue; // Tall walls/pillars block, not walkable floor
      if (Math.abs(x - obs.x) <= obs.halfW && Math.abs(z - obs.z) <= obs.halfD) {
        if (obs.topY > extraY) extraY = obs.topY;
      }
    }
  }
  return terrainY + extraY;
}

export interface TerrainAimPoint {
  x: number;
  y: number;
  z: number;
}

export interface TerrainAimPathOptions {
  mapId: MapId;
  arenaRadius: number;
  startX: number;
  startRelY: number;
  startZ: number;
  dirX: number;
  dirZ: number;
  range: number;
  segments?: number;
  kind: 'line' | 'arc';
  arcPeakHeight?: number;
  endX?: number;
  endZ?: number;
  obstacles?: Array<MapObstacle & { destroyed?: boolean }>;
  ignoreWallStop?: boolean;
}

export interface TerrainAimPathResult {
  points: TerrainAimPoint[];
  groundPoints: TerrainAimPoint[];
  blocked: boolean;
  impactX: number;
  impactY: number;
  impactZ: number;
}

/**
 * Multi-segment terrain-conforming trajectory & ribbon solver:
 * - Samples ground/platform/bridge elevation at every step so aim ribbons never clip into ramps or hills.
 * - Terminates straight projectile/line holograms cleanly against tall blocking walls/pillars with impact markers.
 */
export function computeTerrainConformingAimPath(opts: TerrainAimPathOptions): TerrainAimPathResult {
  const segs = Math.max(4, Math.min(48, opts.segments ?? 28));
  const dirLen = Math.hypot(opts.dirX, opts.dirZ) || 1;
  const nx = opts.dirX / dirLen;
  const nz = opts.dirZ / dirLen;

  const targetX = opts.endX ?? opts.startX + nx * opts.range;
  const targetZ = opts.endZ ?? opts.startZ + nz * opts.range;
  const totalDist = Math.max(0.5, Math.hypot(targetX - opts.startX, targetZ - opts.startZ));

  const points: TerrainAimPoint[] = [];
  const groundPoints: TerrainAimPoint[] = [];

  const startTerrain = getSurfaceHeightAt(
    opts.mapId,
    opts.startX,
    opts.startZ,
    opts.arenaRadius,
    opts.obstacles,
    opts.startRelY
  );
  const endGroundY = getSurfaceHeightAt(
    opts.mapId,
    targetX,
    targetZ,
    opts.arenaRadius,
    opts.obstacles,
    opts.startRelY
  );

  const casterBodyTopRelY = Math.max(1.35, opts.startRelY + 1.35);
  let blocked = false;
  let impactX = targetX;
  let impactY = endGroundY + 0.28;
  let impactZ = targetZ;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const px = opts.startX + (targetX - opts.startX) * t;
    const pz = opts.startZ + (targetZ - opts.startZ) * t;

    const surfaceY = getSurfaceHeightAt(
      opts.mapId,
      px,
      pz,
      opts.arenaRadius,
      opts.obstacles,
      opts.startRelY + (opts.kind === 'arc' ? (opts.arcPeakHeight ?? 3.2) * 4 * t * (1 - t) : 0)
    );

    if (!opts.ignoreWallStop && i > 0 && opts.obstacles && opts.obstacles.length > 0) {
      const sampleRelY =
        opts.kind === 'arc'
          ? opts.startRelY + 1.0 + (opts.arcPeakHeight ?? 3.2) * 4 * t * (1 - t)
          : Math.max(0.85, opts.startRelY + 0.9);
      let hitObs: (MapObstacle & { destroyed?: boolean }) | null = null;
      for (const obs of opts.obstacles) {
        if (obs.destroyed) continue;
        if (obs.kind === 'bridge') continue;
        if (obs.topY <= casterBodyTopRelY && obs.kind === 'platform') continue;
        if (
          sampleRelY < obs.topY &&
          Math.abs(px - obs.x) <= obs.halfW + 0.14 &&
          Math.abs(pz - obs.z) <= obs.halfD + 0.14
        ) {
          hitObs = obs;
          break;
        }
      }
      if (hitObs) {
        blocked = true;
        const wallTerrain = computeMapTerrainHeight(opts.mapId, px, pz, opts.arenaRadius);
        const wallMarkY =
          opts.kind === 'arc'
            ? wallTerrain + Math.min(hitObs.topY, Math.max(0.8, sampleRelY))
            : wallTerrain + Math.max(0.85, Math.min(hitObs.topY * 0.65, casterBodyTopRelY));
        impactX = px;
        impactY = wallMarkY;
        impactZ = pz;
        points.push({ x: px, y: wallMarkY, z: pz });
        groundPoints.push({ x: px, y: surfaceY + 0.28, z: pz });
        break;
      }
    }

    if (opts.kind === 'arc') {
      const startH = startTerrain + opts.startRelY + 1.15;
      const endH = endGroundY + 0.28;
      const baseLinear = startH + (endH - startH) * t;
      const peak = opts.arcPeakHeight ?? Math.min(4.8, 1.4 + totalDist * 0.18);
      const parabola = 4 * peak * t * (1 - t);
      const arcY = Math.max(surfaceY + 0.28, baseLinear + parabola);
      points.push({ x: px, y: arcY, z: pz });
      groundPoints.push({ x: px, y: surfaceY + 0.28, z: pz });
      impactX = px;
      impactY = arcY;
      impactZ = pz;
    } else {
      const ribbonY = surfaceY + 0.28;
      points.push({ x: px, y: ribbonY, z: pz });
      groundPoints.push({ x: px, y: ribbonY, z: pz });
      impactX = px;
      impactY = ribbonY;
      impactZ = pz;
    }
  }

  return { points, groundPoints, blocked, impactX, impactY, impactZ };
}

export function computeTrainRushPosition(opts: {
  laneZ: number;
  dirX: number;
  telegraphRemaining: number;
  remaining: number;
  rushDuration?: number;
}): { active: boolean; trainX: number; trainZ: number; halfLen: number; halfWidth: number } {
  const rushDur = opts.rushDuration ?? 2.2;
  if (opts.telegraphRemaining > 0) {
    return {
      active: false,
      trainX: opts.dirX > 0 ? -42 : 42,
      trainZ: opts.laneZ,
      halfLen: 8.5,
      halfWidth: 2.35,
    };
  }
  const elapsedRush = clamp(rushDur - Math.max(0, opts.remaining - 0.5), 0, rushDur);
  const t = clamp(elapsedRush / rushDur, 0, 1);
  const startX = opts.dirX > 0 ? -44 : 44;
  const endX = opts.dirX > 0 ? 44 : -44;
  return {
    active: t < 1,
    trainX: startX + (endX - startX) * t,
    trainZ: opts.laneZ,
    halfLen: 8.5,
    halfWidth: 2.35,
  };
}
