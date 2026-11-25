export const WIDTH = 850,
  HEIGHT = 460,
  WAVES = 8;
export const route = [
  [855, 75],
  [615, 75],
  [540, 135],
  [265, 135],
  [175, 218],
  [210, 281],
  [530, 281],
  [593, 335],
  [560, 385],
  [110, 385],
  [65, 366],
];
export const posts = [
  [687, 129],
  [483, 84],
  [323, 193],
  [122, 265],
  [350, 332],
  [505, 220],
  [635, 310],
  [215, 423],
];
const lengths = route
  .slice(1)
  .map(([x, y], i) => Math.hypot(x - route[i][0], y - route[i][1]));
export const roadLength = lengths.reduce((a, b) => a + b, 0);
export function position(distance: number, offset = 0) {
  let i = 0;
  while (i < lengths.length - 1 && distance > lengths[i])
    distance -= lengths[i++];
  const [x, y] = route[i],
    dx = (route[i + 1][0] - x) / lengths[i],
    dy = (route[i + 1][1] - y) / lengths[i];
  return {
    x: x + dx * distance - dy * offset,
    y: y + dy * distance + dx * offset,
    angle: Math.atan2(dy, dx),
  };
}

export const corps = {
  line: {
    name: 'Line infantry',
    role: 'A steady four-man volley',
    cost: 40,
    damage: 17,
    range: 122,
    reload: 1.65,
    splash: 0,
  },
  rifle: {
    name: 'Rifle picket',
    role: 'Long reach, heavy single shots',
    cost: 55,
    damage: 35,
    range: 174,
    reload: 2.35,
    splash: 0,
  },
  gun: {
    name: 'Field battery',
    role: 'Round shot bursts across a group',
    cost: 75,
    damage: 25,
    range: 145,
    reload: 3.4,
    splash: 38,
  },
};
export type Corps = keyof typeof corps;
export const doctrines = {
  powder: { name: 'Powder stores', effect: '+20% damage per level' },
  drill: { name: 'Volley drill', effect: '−10% reload time per level' },
  survey: { name: 'Field survey', effect: '+12% range per level' },
};
export type Doctrine = keyof typeof doctrines;
export type Strain = 'walker' | 'runner' | 'brute';
export const strains = {
  walker: { hp: 35, speed: 38, breach: 1 },
  runner: { hp: 23, speed: 66, breach: 1 },
  brute: { hp: 130, speed: 29, breach: 3 },
};
export interface Company {
  kind: Corps;
  priority?: 'front' | 'strong' | 'fast';
  level: number;
  kills: number;
  cooldown: number;
  angle: number;
  shotAge: number;
}
export interface Zombie {
  id: number;
  kind: Strain;
  hp: number;
  maxHp: number;
  distance: number;
  offset: number;
}
export interface Shot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  age: number;
  gun: boolean;
}
export interface Fallen {
  x: number;
  y: number;
  angle: number;
  kind: Strain;
  age: number;
}
export interface Battle {
  phase: 'camp' | 'wave' | 'won' | 'lost';
  wave: number;
  stores: number;
  intel: number;
  gate: number;
  kills: number;
  tech: Record<Doctrine, number>;
  companies: (Company | null)[];
  enemies: Zombie[];
  shots: Shot[];
  fallen: Fallen[];
  sent: number;
  spawnIn: number;
}
export function newBattle(): Battle {
  return {
    phase: 'camp',
    wave: 0,
    stores: 100,
    intel: 0,
    gate: 15,
    kills: 0,
    tech: { powder: 0, drill: 0, survey: 0 },
    companies: posts.map(() => null),
    enemies: [],
    shots: [],
    fallen: [],
    sent: 0,
    spawnIn: 0,
  };
}
export function stats(b: Battle, c: Company) {
  const u = corps[c.kind];
  return {
    damage: Math.round(
      u.damage * (1 + 0.42 * (c.level - 1)) * (1 + 0.2 * b.tech.powder),
    ),
    range: Math.round(
      u.range * (1 + 0.05 * (c.level - 1) + 0.12 * b.tech.survey),
    ),
    reload: u.reload * (1 - 0.1 * b.tech.drill),
    splash: u.splash,
  };
}
export function deploy(b: Battle, i: number, kind: Corps) {
  if (
    b.phase !== 'camp' ||
    !posts[i] ||
    b.companies[i] ||
    b.stores < corps[kind].cost
  )
    return;
  b.stores -= corps[kind].cost;
  b.companies[i] = {
    kind,
    level: 1,
    kills: 0,
    angle: 0,
    cooldown: 0,
    shotAge: 10,
  };
}
export const upgradeCost = (c: Company) => 20 * c.level + 10;
export function promote(b: Battle, i: number) {
  const c = b.companies[i];
  if (b.phase !== 'camp' || !c || c.level >= 4 || b.stores < upgradeCost(c))
    return;
  b.stores -= upgradeCost(c);
  c.level++;
}
export function research(b: Battle, key: Doctrine) {
  const cost = b.tech[key] + 1;
  if (b.phase !== 'camp' || cost > 3 || b.intel < cost) return;
  b.intel -= cost;
  b.tech[key]++;
}
export const waveSize = (wave: number) => 8 + wave * 4;
export function strainAt(w: number, i: number): Strain {
  if (w >= 4 && i % (w >= 7 ? 5 : 8) === 0) return 'brute';
  return w >= 2 && i % (w >= 5 ? 3 : 4) === 1 ? 'runner' : 'walker';
}
export function startWave(b: Battle) {
  if (b.phase !== 'camp' || !b.companies.some(Boolean)) return;
  b.wave++;
  b.phase = 'wave';
  b.sent = 0;
  b.spawnIn = 0;
}
export function tick(b: Battle, dt: number) {
  if (b.phase !== 'wave') return;
  b.spawnIn -= dt;
  if (b.sent < waveSize(b.wave) && b.spawnIn <= 0) {
    const id = b.sent++,
      kind = strainAt(b.wave, id),
      hp = Math.round(strains[kind].hp * (1 + 0.16 * (b.wave - 1)));
    b.enemies.push({
      id,
      kind,
      hp,
      maxHp: hp,
      distance: 0,
      offset: ((id * 13) % 31) - 15,
    });
    b.spawnIn += id % 7 === 6 ? 1.65 : 0.35;
  }
  for (const z of b.enemies) z.distance += strains[z.kind].speed * dt;
  for (const s of b.shots) s.age += dt;
  for (const f of b.fallen) f.age += dt;
  b.shots = b.shots.filter((s) => s.age < 0.45);
  b.fallen = b.fallen.filter((f) => f.age < 3);
  const located = b.enemies
    .map((z) => ({ z, ...position(z.distance, z.offset) }))
    .sort((a, d) => d.z.distance - a.z.distance);
  b.companies.forEach((c, i) => {
    if (!c) return;
    c.shotAge += dt;
    c.cooldown = Math.max(0, c.cooldown - dt);
    if (c.cooldown > 0) return;
    const [x, y] = posts[i],
      s = stats(b, c);
    const inRange = located.filter(
      (t) => t.z.hp > 0 && Math.hypot(x - t.x, y - t.y) <= s.range,
    );
    if (c.priority === 'strong') inRange.sort((a, b) => b.z.hp - a.z.hp);
    if (c.priority === 'fast')
      inRange.sort((a, b) => strains[b.z.kind].speed - strains[a.z.kind].speed);
    const target = inRange[0];
    if (!target) return;
    c.angle = Math.atan2(target.y - y, target.x - x);
    c.cooldown = s.reload;
    c.shotAge = 0;
    b.shots.push({
      x,
      y,
      tx: target.x,
      ty: target.y,
      age: 0,
      gun: c.kind === 'gun',
    });
    for (const t of located) {
      if (
        t.z.hp <= 0 ||
        (t !== target &&
          (!s.splash || Math.hypot(t.x - target.x, t.y - target.y) > s.splash))
      )
        continue;
      t.z.hp -= s.damage;
      if (t.z.hp <= 0) {
        c.kills++;
        b.kills++;
        b.stores++;
        b.fallen.push({
          x: t.x,
          y: t.y,
          angle: t.angle,
          kind: t.z.kind,
          age: 0,
        });
      }
    }
  });
  b.enemies = b.enemies.filter((z) => {
    if (z.hp <= 0) return false;
    if (z.distance < roadLength) return true;
    b.gate = Math.max(0, b.gate - strains[z.kind].breach);
    return false;
  });
  if (!b.gate) b.phase = 'lost';
  else if (b.sent === waveSize(b.wave) && !b.enemies.length) {
    b.phase = b.wave === WAVES ? 'won' : 'camp';
    b.stores += 22 + 2 * b.wave;
    b.intel += 2;
    b.companies.forEach((c) => {
      if (c) {
        c.cooldown = 0;
        c.shotAge = 10;
      }
    });
  }
}
