import { describe, expect, it } from 'vitest';
import {
  newBattle,
  deploy,
  promote,
  research,
  startWave,
  tick,
  stats,
  WAVES,
  type Battle,
} from './battle';

function finishWave(b: Battle) {
  startWave(b);
  expect(b.phase).toBe('wave');
  for (let i = 0; i < 18000 && b.phase === 'wave'; i++) tick(b, 1 / 30);
  expect(b.phase).not.toBe('wave');
}
describe('Fort Vesper campaign', () => {
  it('charges once for purchases and locks requisitions during an attack', () => {
    const b = newBattle();
    deploy(b, 0, 'line');
    deploy(b, 0, 'line');
    expect(b.stores).toBe(60);
    startWave(b);
    deploy(b, 1, 'line');
    promote(b, 0);
    expect(b.companies[1]).toBeNull();
    expect(b.companies[0]?.level).toBe(1);
    expect(b.stores).toBe(60);
  });
  it('applies research to current and newly deployed companies', () => {
    const b = newBattle();
    deploy(b, 0, 'line');
    b.intel = 3;
    research(b, 'powder');
    research(b, 'powder');
    deploy(b, 1, 'line');
    expect(b.intel).toBe(0);
    expect(stats(b, b.companies[0]!).damage).toBe(24);
    expect(stats(b, b.companies[1]!).damage).toBe(24);
    research(b, 'powder');
    expect(b.tech.powder).toBe(2);
  });
  it('allows a mixed garrison to hold all eight waves using earned supplies', () => {
    const b = newBattle();
    deploy(b, 0, 'line');
    deploy(b, 2, 'rifle');
    for (let i = 0; i < WAVES; i++) {
      research(b, i % 2 ? 'powder' : 'survey');
      for (const j of [4, 5, 3, 1, 6, 7]) deploy(b, j, j % 2 ? 'line' : 'gun');
      for (const j of [2, 4, 5, 0]) promote(b, j);
      finishWave(b);
    }
    expect(b.phase).toBe('won');
    expect(b.gate).toBeGreaterThan(0);
    expect(b.kills).toBe(b.companies.reduce((n, c) => n + (c?.kills ?? 0), 0));
  });
  it('ends an underdefended campaign when the gate falls', () => {
    const b = newBattle();
    deploy(b, 7, 'line');
    for (let i = 0; i < WAVES && b.phase === 'camp'; i++) finishWave(b);
    expect(b.phase).toBe('lost');
    expect(b.gate).toBe(0);
    startWave(b);
    expect(b.phase).toBe('lost');
  });
});
