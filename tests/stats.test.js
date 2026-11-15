const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/state.js');
const Stats = require('../js/stats.js');

test('뽑기/합성 시 통계와 기록이 쌓임 (최신이 앞)', () => {
  const s = S.createState();
  s.wonderBerry = 6;
  s.lunaCrystal = 1;
  S.drawWonderBerry(s, 5);
  S.confirmPending(s);
  S.drawWonderBerry(s, 1, () => 0);
  S.confirmPending(s);
  assert.equal(Stats.summarize(s, 'draw').total, 6);
  assert.equal(s.history.length, 2);
  assert.equal(s.history[0].ids.length, 1);
  assert.equal(s.history[1].ids.length, 5);
  assert.equal(s.history[0].source, 'draw');
});

test('공식 확률 묶음 합계: 원더베리 9.96/60/30.04, 스윗 86.4/11.64/1.96, 드림 75.6/20.4/4', () => {
  const s = S.createState();
  const off = (src) => Stats.summarize(s, src).rows.map((r) => r.official);
  assert.deepEqual(off('draw'), [9.96, 60, 30.04]);
  assert.deepEqual(off('sweet'), [86.4, 11.64, 1.96]);
  assert.deepEqual(off('dream'), [75.6, 20.4, 4]);
});

test('실제 비율 계산: 키 1회 + 쁘띠 1회 합성이면 각 50%', () => {
  const s = S.createState();
  s.stats.sweet['key'] = 1;
  s.stats.sweet['petit:백야'] = 1;
  const rows = Stats.summarize(s, 'sweet').rows;
  assert.deepEqual(rows.map((r) => r.count), [0, 1, 1]);
  assert.equal(rows[1].actual, 50);
  assert.equal(Stats.summarize(S.createState(), 'sweet').rows[0].actual, 0); // 0회일 때 NaN 없음
});

test('기록은 최대 50개까지만 유지', () => {
  const s = S.createState();
  s.wonderBerry = 70;
  for (let i = 0; i < 60; i++) { S.drawWonderBerry(s, 1); S.confirmPending(s); }
  assert.equal(s.history.length, S.HISTORY_LIMIT);
  assert.equal(Stats.summarize(s, 'draw').total, 60);
});

test('통계/기록 저장·복구, 깨진 데이터는 정리', () => {
  const store = new Map();
  const st = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const s = S.createState();
  s.wonderBerry = 2;
  S.drawWonderBerry(s, 1); S.confirmPending(s);
  S.save(st, s);
  const loaded = S.load(st);
  assert.deepEqual(loaded.stats, s.stats);
  assert.deepEqual(loaded.history, s.history);
  const bad = { getItem: () => JSON.stringify({ stats: { draw: { nope: 3, key: -1 }, x: 1 }, history: [{ time: 'a' }, { time: 1, source: 'sweet', ids: ['key', 'zz'] }] }), setItem() {} };
  const l2 = S.load(bad);
  assert.deepEqual(l2.stats, { draw: {}, sweet: {}, dream: {} });
  assert.deepEqual(l2.history, [{ time: 1, source: 'sweet', ids: ['key'] }]);
});
