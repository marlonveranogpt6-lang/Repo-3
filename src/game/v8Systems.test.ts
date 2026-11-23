import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAP_BY_ID,
  createMatchObstacleStates,
  getMapPickupSpawns,
  getMapItemDropSpawns,
  TACTICAL_ITEMS,
  TACTICAL_ITEMS_BY_KIND,
  type MapId,
} from '../shared/gameData.ts';
import {
  MAP_TERRAIN_ZONES,
  MAP_ENTERABLE_BUILDINGS,
  OPEN_CENTER_CLEAR_RADIUS,
  computeMapTerrainHeight,
  computeTerrainConformingAimPath,
  evaluateTerrainZonesAt,
  findEnterableBuildingAt,
  getSurfaceHeightAt,
  rollTempleNpcSpawn,
} from './mapLogic.ts';

const ALL_MAPS: MapId[] = ['shibuya', 'meadow', 'temple', 'obsidian'];

test('Center duel ring (r < 11.5m) remains clean & unobstructed across all 4 maps', () => {
  for (const mapId of ALL_MAPS) {
    const obstacles = createMatchObstacleStates(mapId);
    for (const obs of obstacles) {
      if (obs.destroyed) continue;
      // Closest point on obstacle AABB to origin (0, 0)
      const cx = Math.max(obs.x - obs.halfW, Math.min(0, obs.x + obs.halfW));
      const cz = Math.max(obs.z - obs.halfD, Math.min(0, obs.z + obs.halfD));
      const minDist = Math.hypot(cx, cz);
      assert.ok(
        minDist >= OPEN_CENTER_CLEAR_RADIUS - 0.1,
        `${mapId} obstacle ${obs.id} encroaches inside center r<11.5 (minDist=${minDist.toFixed(2)})`
      );
    }

    for (const b of MAP_ENTERABLE_BUILDINGS[mapId]) {
      const cx = Math.max(b.x - b.halfW, Math.min(0, b.x + b.halfW));
      const cz = Math.max(b.z - b.halfD, Math.min(0, b.z + b.halfD));
      assert.ok(
        Math.hypot(cx, cz) >= OPEN_CENTER_CLEAR_RADIUS,
        `${mapId} building ${b.id} enters center`
      );
    }

    for (const pk of getMapPickupSpawns(mapId)) {
      assert.ok(
        Math.hypot(pk.x, pk.z) >= OPEN_CENTER_CLEAR_RADIUS,
        `${mapId} pickup ${pk.id} spawned in center`
      );
    }

    for (const it of getMapItemDropSpawns(mapId)) {
      assert.ok(
        Math.hypot(it.x, it.z) >= OPEN_CENTER_CLEAR_RADIUS,
        `${mapId} item ${it.id} spawned in center`
      );
    }

    // Center level terrain should stay near y = 0
    assert.equal(computeMapTerrainHeight(mapId, 0, 0, MAP_BY_ID[mapId].arenaRadius), 0);
  }
});

test('All maps include Health, Chi (mana), and Strength orbs plus all 6 tactical items', () => {
  assert.equal(TACTICAL_ITEMS.length, 6);
  for (const mapId of ALL_MAPS) {
    const spawns = getMapPickupSpawns(mapId);
    const kinds = new Set(spawns.map((s) => s.kind));
    assert.equal(kinds.has('health'), true, `${mapId} should have health orbs`);
    assert.equal(kinds.has('mana'), true, `${mapId} should have chi orbs`);
    assert.equal(kinds.has('strength'), true, `${mapId} should have strength orbs`);

    const itemSpawns = getMapItemDropSpawns(mapId);
    const itemKinds = new Set(itemSpawns.map((i) => i.kind));
    for (const item of TACTICAL_ITEMS) {
      assert.equal(itemKinds.has(item.kind), true, `${mapId} should spawn ${item.kind}`);
      assert.ok(TACTICAL_ITEMS_BY_KIND[item.kind]);
    }
  }
});

test('Meadow features Corner Ancient Coliseum & descending Underground Catacombs', () => {
  const arenaR = MAP_BY_ID.meadow.arenaRadius;
  const buildings = MAP_ENTERABLE_BUILDINGS.meadow;
  const coliseum = buildings.find((b) => b.style === 'coliseum');
  const catacombs = buildings.find((b) => b.style === 'catacomb');
  assert.ok(coliseum, 'Meadow should include Corner Ancient Coliseum');
  assert.ok(catacombs, 'Meadow should include Underground Catacombs');
  assert.equal(catacombs.isSubterranean, true);

  const subFloorY = computeMapTerrainHeight('meadow', catacombs.x, catacombs.z, arenaR);
  assert.ok(subFloorY <= -2.8, `Expected catacomb floor <= -2.8m, got ${subFloorY}`);

  const inside = findEnterableBuildingAt('meadow', catacombs.x, 0, catacombs.z);
  assert.equal(inside?.id, catacombs.id);

  // Stairway entry outside chamber rim transitions smoothly between 0 and subterranean depth
  const stairY = computeMapTerrainHeight('meadow', 12.8, 12.4, arenaR);
  assert.ok(stairY < -0.5 && stairY > subFloorY, `Expected mid-stair elevation, got ${stairY}`);
});

test('Terrain-conforming aim holograms climb bridges/hills and halt cleanly at tall walls', () => {
  const obstacles = createMatchObstacleStates('temple');
  const arenaR = MAP_BY_ID.temple.arenaRadius;

  // 1. Aiming across West Koi Pond Pagoda Bridge (-23 -> -12 at z=5.5) climbs smoothly over bridge arch
  const bridgeAim = computeTerrainConformingAimPath({
    mapId: 'temple',
    arenaRadius: arenaR,
    startX: -24,
    startRelY: 0,
    startZ: 5.5,
    dirX: 1,
    dirZ: 0,
    range: 13,
    kind: 'line',
    obstacles,
  });
  const startY = bridgeAim.points[0].y;
  const peakY = Math.max(...bridgeAim.points.map((p) => p.y));
  assert.ok(peakY > startY + 0.35, `Aim ribbon should curve up pagoda bridge (start=${startY}, peak=${peakY})`);

  // 2. Aiming straight into Bamboo Dojo wall terminates cleanly at wall impact with blocked=true
  const wallAim = computeTerrainConformingAimPath({
    mapId: 'temple',
    arenaRadius: arenaR,
    startX: -18.5,
    startRelY: 0,
    startZ: -8.0,
    dirX: 0,
    dirZ: -1,
    range: 18,
    kind: 'line',
    obstacles,
  });
  assert.equal(wallAim.blocked, true);
  assert.ok(wallAim.points.length < 29, 'Blocked projectile line must terminate early at wall');
  assert.ok(wallAim.impactZ < -8.0 && wallAim.impactZ > -22.0);

  // 3. Parabolic arc aim path for throwables rises overhead and lands on surface
  const arcAim = computeTerrainConformingAimPath({
    mapId: 'obsidian',
    arenaRadius: MAP_BY_ID.obsidian.arenaRadius,
    startX: 0,
    startRelY: 0,
    startZ: 0,
    dirX: 1,
    dirZ: 0,
    range: 10,
    kind: 'arc',
    obstacles: createMatchObstacleStates('obsidian'),
  });
  const midPoint = arcAim.points[Math.floor(arcAim.points.length / 2)];
  const groundAtMid = getSurfaceHeightAt('obsidian', midPoint.x, midPoint.z, MAP_BY_ID.obsidian.arenaRadius);
  assert.ok(midPoint.y > groundAtMid + 2.0, 'Arc mid-trajectory should arch well above ground');
});

test('Cryo water freeze converts water slow into slick ice stride & Temple NPC rolls at 50%', () => {
  const pond = MAP_TERRAIN_ZONES.temple.find((z) => z.kind === 'water');
  assert.ok(pond);

  // Off-bridge water normally slows (-30%)
  const wetEval = evaluateTerrainZonesAt('temple', pond.x, 0, pond.z + 2.5);
  assert.equal(wetEval.inWater, true);
  assert.equal(wetEval.speedMultiplier, 0.7);

  // With Cryo frozen zone covering the water tile, inWater is cleared & player gets ice stride (+8%)
  const frozenEval = evaluateTerrainZonesAt('temple', pond.x, 0, pond.z + 2.5, undefined, [
    { x: pond.x, z: pond.z + 2.5, radius: 4.8 },
  ]);
  assert.equal(frozenEval.inWater, false);
  assert.equal(frozenEval.onIce, true);
  assert.equal(frozenEval.speedMultiplier, 1.08);

  assert.equal(rollTempleNpcSpawn(() => 0.49), true);
  assert.equal(rollTempleNpcSpawn(() => 0.5), false);
});
