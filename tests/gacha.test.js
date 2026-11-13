const test = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../js/data.js');
const Gacha = require('../js/gacha.js');

const sum = (t) => t.reduce((s, e) => s + e.prob, 0);
const near = (a, b) => Math.abs(a - b) < 1e-9;

// 시드 고정 난수 (mulberry32)
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('각 확률표의 합은 100%', () => {
  assert.ok(near(sum(Data.WONDER_BERRY_TABLE), 100));
  assert.ok(near(sum(Data.SWEET_TABLE), 100));
  assert.ok(near(sum(Data.DREAM_TABLE), 100));
});

test('원더베리 표 값이 공식과 일치', () => {
  const t = Object.fromEntries(Data.WONDER_BERRY_TABLE.map((e) => [e.name, e.prob]));
  assert.equal(t['이그넬라'], 3.32);
  assert.equal(t['카투'], 12);
  assert.equal(t['오가닉 원더 쿠키'], 15.02);
});

test('드림 베이스 제외: 베이스 없음, 나머지 8종 각 9.45%, 합 100%', () => {
  const table = Gacha.getDreamTable('프링');
  assert.ok(!table.some((e) => e.name === '프링' && e.kind === Data.KIND.DREAM_PET));
  const pets = table.filter((e) => e.kind === Data.KIND.DREAM_PET);
  assert.equal(pets.length, 8);
  pets.forEach((p) => assert.ok(near(p.prob, 9.45)));
  assert.ok(near(sum(table), 100));
});

test('드림 베이스가 목록에 없으면 표 그대로', () => {
  assert.equal(Gacha.getDreamTable('이그넬라').length, Data.DREAM_TABLE.length);
});

test('드림 추첨 시 베이스 펫이 절대 나오지 않음', () => {
  const rng = seeded(1);
  for (let i = 0; i < 20000; i++) {
    const r = Gacha.rollDream('레옹', rng);
    assert.ok(!(r.kind === Data.KIND.DREAM_PET && r.name === '레옹'));
  }
});

test('시드 고정 분포가 공식 확률에 근접 (스윗 쁘띠 합 11.64%)', () => {
  const rng = seeded(42);
  const N = 200000;
  let petit = 0;
  for (let i = 0; i < N; i++) if (Gacha.rollSweet(rng).kind === Data.KIND.PETIT) petit++;
  assert.ok(Math.abs((petit / N) * 100 - 11.64) < 0.3);
});

test('원더베리 희귀 비율이 9.96%에 근접', () => {
  const rng = seeded(7);
  const N = 200000;
  let rare = 0;
  for (let i = 0; i < N; i++) if (Gacha.rollWonderBerry(rng).kind === Data.KIND.WONDER_BLACK) rare++;
  assert.ok(Math.abs((rare / N) * 100 - 9.96) < 0.3);
});
