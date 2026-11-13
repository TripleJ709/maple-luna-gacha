const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/state.js');

function memoryStorage(initial) {
  const m = new Map(initial ? [[S.STORAGE_KEY, initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}

test('충전은 현재 캐시에 더하기만 하고 누적 사용 금액은 변하지 않음', () => {
  const s = S.createState();
  assert.deepEqual(S.charge(s, 10000), { ok: true });
  assert.deepEqual(S.charge(s, 1000000), { ok: true });
  assert.equal(s.cash, 1010000);
  assert.equal(s.totalSpent, 0);
});

test('범위 밖/단위 불일치/잘못된 값은 거부하고 상태를 바꾸지 않음', () => {
  const s = S.createState();
  [9999, 0, -10000, 1010000, 15000, 10000.5, NaN, '10000', null].forEach((v) => {
    assert.equal(S.charge(s, v).ok, false, String(v));
  });
  assert.equal(s.cash, 0);
});

test('저장 후 다시 불러오면 값이 유지됨', () => {
  const st = memoryStorage();
  const s = S.createState();
  S.charge(s, 50000);
  s.inventory['wb:카투'] = 3;
  S.save(st, s);
  assert.deepEqual(S.load(st), s);
});

test('저장 데이터가 없거나 깨져 있으면 기본 상태로 복구', () => {
  assert.deepEqual(S.load(memoryStorage()), S.createState());
  assert.deepEqual(S.load(memoryStorage('{깨진 json')), S.createState());
  const dirty = JSON.stringify({ cash: -5, totalSpent: 'x', wonderBerry: 2, inventory: { a: -1, b: 2, c: 1.5 } });
  const loaded = S.load(memoryStorage(dirty));
  assert.equal(loaded.cash, 0);
  assert.equal(loaded.totalSpent, 0);
  assert.equal(loaded.wonderBerry, 2);
  assert.deepEqual(loaded.inventory, { b: 2 });
});
