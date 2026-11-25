import './style.css';
import {
  corps,
  doctrines,
  deploy,
  newBattle,
  posts,
  promote,
  research,
  startWave,
  stats,
  strainAt,
  tick,
  upgradeCost,
  waveSize,
  WAVES,
  type Battle,
  type Corps,
  type Doctrine,
  type Strain,
} from './battle';
import { drawField, loadTroops } from './field';

const $ = (id: string) => document.getElementById(id)!;
const button = (id: string) => $(id) as HTMLButtonElement;
const saveKey = 'austerblitz.dead-march.camp.v1';
function restore(): Battle {
  try {
    const raw = localStorage.getItem(saveKey);
    if (raw) {
      const b = JSON.parse(raw) as Battle;
      if (
        b.phase === 'camp' &&
        b.companies?.length === posts.length &&
        b.tech &&
        b.wave >= 0 &&
        b.wave < WAVES
      )
        return b;
    }
  } catch {
    /* Storage is optional in private browsing. */
  }
  return newBattle();
}
let b = restore(),
  selected = 0,
  tab = 'post',
  paused = false,
  speed = 1,
  clock = 0,
  preview: Corps = 'line',
  ready = false;
const canvas = document.querySelector('canvas')!,
  g = canvas.getContext('2d')!;
function save() {
  try {
    if (b.phase === 'camp') localStorage.setItem(saveKey, JSON.stringify(b));
    if (b.phase === 'won' || b.phase === 'lost')
      localStorage.removeItem(saveKey);
  } catch {
    /* Campaign continues when browser storage is unavailable. */
  }
}
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const markers = posts.map(([x, y], i) => {
  const el = document.createElement('button');
  el.className = 'marker';
  el.style.left = (x / 850) * 100 + '%';
  el.style.top = (y / 460) * 100 + '%';
  el.innerHTML = '<span>' + roman[i] + '</span>';
  el.setAttribute('aria-label', 'Select emplacement ' + roman[i]);
  el.onclick = () => {
    selected = i;
    tab = 'post';
    refresh();
  };
  $('markers').append(el);
  return el;
});
function choice(
  title: string,
  tag: string,
  detail: string,
  disabled: boolean,
  action: () => void,
) {
  const el = document.createElement('button');
  el.className = 'choice';
  el.disabled = disabled;
  el.innerHTML =
    '<b>' + title + '<em>' + tag + '</em></b><small>' + detail + '</small>';
  el.onclick = () => {
    action();
    save();
    refresh();
  };
  $('panel').append(el);
  return el;
}
function panel() {
  const target = $('panel'),
    c = b.companies[selected],
    camp = b.phase === 'camp';
  button('postTab').setAttribute('aria-selected', String(tab === 'post'));
  button('techTab').setAttribute('aria-selected', String(tab === 'tech'));
  if (tab === 'tech') {
    target.innerHTML =
      '<h3>Field research</h3><p>Earn two points per wave. Each discovery applies to every company.</p>';
    for (const k of Object.keys(doctrines) as Doctrine[]) {
      const n = b.tech[k];
      choice(
        doctrines[k].name,
        n === 3 ? 'Complete' : n + 1 + ' RP',
        doctrines[k].effect + ' · ' + n + '/3',
        !camp || n === 3 || b.intel < n + 1,
        () => research(b, k),
      );
    }
  } else if (c) {
    const s = stats(b, c);
    target.innerHTML =
      '<h3>' +
      corps[c.kind].name +
      '</h3><p>Post ' +
      roman[selected] +
      ' · Rank ' +
      roman[c.level - 1] +
      '</p><dl>' +
      Object.entries({
        'Volley damage': s.damage,
        Range: s.range + ' paces',
        Reload: s.reload.toFixed(2) + ' s',
        'Blast radius': s.splash ? s.splash + ' paces' : '—',
        Kills: '<span id="companyKills">' + c.kills + '</span>',
      })
        .map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>')
        .join('') +
      '</dl>';
    const priorities = {
      front: 'Closest to gate',
      strong: 'Highest health',
      fast: 'Fastest',
    };
    choice(
      'Fire orders',
      priorities[c.priority ?? 'front'],
      'Cycle this company’s target priority.',
      b.phase === 'won' || b.phase === 'lost',
      () => {
        c.priority =
          c.priority === 'strong'
            ? 'fast'
            : c.priority === 'fast'
              ? 'front'
              : 'strong';
      },
    );
    choice(
      'Upgrade company',
      c.level === 4 ? 'Max rank' : upgradeCost(c) + ' supplies',
      'Increase volley damage and range.',
      !camp || c.level === 4 || b.stores < upgradeCost(c),
      () => promote(b, selected),
    );
  } else {
    target.innerHTML =
      '<h3>Post ' +
      roman[selected] +
      '</h3><p>Select a company to occupy this emplacement.</p>';
    for (const k of Object.keys(corps) as Corps[]) {
      const u = corps[k],
        s = stats(b, {
          kind: k,
          level: 1,
          kills: 0,
          cooldown: 0,
          angle: 0,
          shotAge: 0,
        });
      const el = choice(
        u.name,
        u.cost + ' supplies',
        u.role +
          ' · ' +
          s.damage +
          ' dmg / ' +
          s.range +
          ' paces / ' +
          s.reload.toFixed(2) +
          ' s',
        !camp || b.stores < u.cost,
        () => deploy(b, selected, k),
      );
      el.onmouseenter = el.onfocus = () => {
        preview = k;
      };
    }
  }
  if (b.phase === 'wave')
    target.insertAdjacentHTML(
      'beforeend',
      '<small class="note">Reinforcements arrive between waves.</small>',
    );
}
function refresh() {
  const w = b.phase === 'camp' ? b.wave + 1 : b.wave;
  $('gate').textContent = b.gate + '/15';
  $('stores').textContent = String(b.stores);
  $('intel').textContent = String(b.intel);
  $('phase').textContent = {
    camp: 'Preparations',
    wave: paused ? 'Paused' : 'Under attack',
    won: 'Secured',
    lost: 'Overrun',
  }[b.phase];
  $('wave').textContent =
    b.phase === 'won'
      ? 'Fort Vesper holds'
      : b.phase === 'lost'
        ? 'The gate has fallen'
        : 'Wave ' + roman[w - 1] + ' of VIII';
  const roster: Record<Strain, number> = { walker: 0, runner: 0, brute: 0 };
  for (let i = 0; i < waveSize(w); i++) roster[strainAt(w, i)]++;
  $('remaining').textContent =
    b.phase === 'wave'
      ? waveSize(w) - b.sent + b.enemies.length + ' approaching'
      : b.kills + ' kills';
  $('brief').textContent =
    b.phase === 'camp'
      ? (b.wave === 0
          ? 'Choose a post on the map and deploy your first company. '
          : 'Prepare the line. ') +
        'Scouts report ' +
        Object.entries(roster)
          .filter(([, n]) => n)
          .map(([k, n]) => n + ' ' + k + (n === 1 ? '' : 's'))
          .join(', ') +
        '.'
      : b.phase === 'wave'
        ? 'Hold the road. Each brute that reaches the gate costs three integrity.'
        : 'Your companies stopped ' +
          b.kills +
          ' undead across ' +
          b.wave +
          ' waves.';
  $('progress').innerHTML = roman
    .map(
      (_, i) =>
        '<i class="' +
        (i < b.wave - (b.phase === 'wave' ? 1 : 0)
          ? 'done'
          : i === w - 1
            ? 'active'
            : '') +
        '"></i>',
    )
    .join('');
  button('start').disabled =
    !ready || b.phase !== 'camp' || !b.companies.some(Boolean);
  button('start').textContent =
    b.phase === 'wave' ? 'Wave underway' : 'Send wave ' + roman[w - 1];
  button('pause').disabled = b.phase !== 'wave';
  button('pause').textContent = paused ? 'Resume' : 'Pause';
  button('speed').textContent = 'Speed ×' + speed;
  markers.forEach((m, i) =>
    m.setAttribute('aria-pressed', String(i === selected)),
  );
  panel();
}
button('postTab').onclick = () => {
  tab = 'post';
  refresh();
};
button('techTab').onclick = () => {
  tab = 'tech';
  refresh();
};
button('start').onclick = () => {
  startWave(b);
  paused = false;
  refresh();
};
button('speed').onclick = () => {
  speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  refresh();
};
button('pause').onclick = () => {
  paused = !paused;
  refresh();
};
button('restart').onclick = () => {
  if (
    (b.phase === 'camp' || b.phase === 'wave') &&
    (b.wave || b.companies.some(Boolean)) &&
    !confirm('Start a new campaign and replace this defense?')
  )
    return;
  b = newBattle();
  selected = 0;
  tab = 'post';
  paused = false;
  speed = 1;
  save();
  refresh();
};
refresh();
loadTroops()
  .then(() => {
    ready = true;
    refresh();
    let last = performance.now(),
      hud = 0;
    function frame(t: number) {
      const elapsed = Math.min(0.12, (t - last) / 1000);
      last = t;
      if (!paused && b.phase === 'wave') {
        const phase = b.phase;
        for (let step = 0; step < speed; step++) {
          tick(b, elapsed);
          clock += elapsed;
        }
        hud += elapsed;
        if (b.phase !== phase) {
          save();
          refresh();
          hud = 0;
        } else if (hud > 0.3) {
          $('remaining').textContent =
            waveSize(b.wave) - b.sent + b.enemies.length + ' approaching';
          $('stores').textContent = String(b.stores);
          $('gate').textContent = b.gate + '/15';
          const kills = document.getElementById('companyKills');
          if (kills)
            kills.textContent = String(b.companies[selected]?.kills ?? 0);
          hud = 0;
        }
      }
      drawField(g, b, selected, clock, preview);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })
  .catch(() => {
    $('brief').textContent =
      'The troop sprites could not load. Reload this page to retry.';
  });
