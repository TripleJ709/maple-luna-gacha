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

test('원더베리 1개 구매: 캐시 5,400원 감소, 누적 사용 금액 5,400원 증가', () => {
  const s = S.createState();
  S.charge(s, 10000);
  assert.deepEqual(S.purchase(s, 'wonderBerry1'), { ok: true });
  assert.equal(s.cash, 4600);
  assert.equal(s.totalSpent, 5400);
  assert.equal(s.wonderBerry, 1);
});

test('원더베리 11개 54,000원, 루나 크리스탈 1개 3,900원', () => {
  const s = S.createState();
  S.charge(s, 100000);
  S.purchase(s, 'wonderBerry11');
  S.purchase(s, 'lunaCrystal1');
  assert.equal(s.wonderBerry, 11);
  assert.equal(s.lunaCrystal, 1);
  assert.equal(s.cash, 100000 - 54000 - 3900);
  assert.equal(s.totalSpent, 57900);
});

test('캐시 부족이면 구매 거부하고 상태 불변, 정확히 같은 금액은 구매 가능', () => {
  const s = S.createState();
  S.charge(s, 10000);
  S.purchase(s, 'wonderBerry1');
  const before = JSON.stringify(s);
  assert.deepEqual(S.purchase(s, 'wonderBerry11'), { ok: false, error: '캐시가 부족합니다.' });
  assert.equal(JSON.stringify(s), before);
  s.cash = 3900;
  assert.equal(S.purchase(s, 'lunaCrystal1').ok, true);
  assert.equal(s.cash, 0);
});

test('알 수 없는 상품은 거부', () => {
  const s = S.createState();
  s.cash = 100000;
  assert.equal(S.purchase(s, 'nope').ok, false);
  assert.equal(S.purchase(s, 'toString').ok, false);
  assert.equal(s.cash, 100000);
});

test('1회 뽑기는 원더베리 1개, 5회 뽑기는 5개를 차감하고 결과를 인벤토리에 누적', () => {
  const s = S.createState();
  s.wonderBerry = 6;
  const r1 = S.drawWonderBerry(s, 1);
  assert.equal(r1.ok, true);
  assert.equal(r1.results.length, 1);
  assert.equal(s.wonderBerry, 5);
  const r5 = S.drawWonderBerry(s, 5);
  assert.equal(r5.results.length, 5);
  assert.equal(s.wonderBerry, 0);
  const total = Object.values(s.inventory).reduce((a, b) => a + b, 0);
  assert.equal(total, 6);
});

test('원더베리 부족/잘못된 횟수는 거부하고 상태 불변', () => {
  const s = S.createState();
  s.wonderBerry = 4;
  const before = JSON.stringify(s);
  assert.deepEqual(S.drawWonderBerry(s, 5), { ok: false, error: '원더베리가 부족합니다.' });
  assert.equal(S.drawWonderBerry(s, 2).ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('뽑기 결과 id는 모두 ITEM_INDEX에 존재', () => {
  const Data = require('../js/data.js');
  const s = S.createState();
  s.wonderBerry = 300;
  for (let i = 0; i < 60; i++) S.drawWonderBerry(s, 5);
  Object.keys(s.inventory).forEach((id) => assert.ok(Data.ITEM_INDEX[id], id));
});

const Data = require('../js/data.js');
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('스윗 합성: 같은 종류 2개(이그넬라+이그넬라) 가능, 재료와 크리스탈 소모, 결과 지급', () => {
  const s = S.createState();
  s.inventory['wb:이그넬라'] = 2;
  s.lunaCrystal = 1;
  const r = S.synthesizeSweet(s, 'wb:이그넬라', 'wb:이그넬라', seq(0));
  assert.equal(r.ok, true);
  assert.equal(r.result.kind, Data.KIND.SWEET_PET);
  assert.equal(s.inventory['wb:이그넬라'], undefined);
  assert.equal(s.lunaCrystal, 0);
  assert.equal(s.inventory[r.result.id], 1);
});

test('스윗 합성: 다른 종류 2개(이그넬라+아쿠엘) 가능', () => {
  const s = S.createState();
  s.inventory['wb:이그넬라'] = 1;
  s.inventory['wb:아쿠엘'] = 3;
  s.lunaCrystal = 2;
  assert.equal(S.synthesizeSweet(s, 'wb:이그넬라', 'wb:아쿠엘').ok, true);
  assert.equal(s.inventory['wb:이그넬라'], undefined);
  assert.equal(s.inventory['wb:아쿠엘'], 2);
  assert.equal(s.lunaCrystal, 1);
});

test('스윗 합성: 같은 종류를 1개만 가지고 2개로 선택하면 거부, 상태 불변', () => {
  const s = S.createState();
  s.inventory['wb:윈디르'] = 1;
  s.lunaCrystal = 1;
  const before = JSON.stringify(s);
  assert.deepEqual(S.synthesizeSweet(s, 'wb:윈디르', 'wb:윈디르'), { ok: false, error: '재료가 부족합니다.' });
  assert.equal(JSON.stringify(s), before);
});

test('스윗 합성: 크리스탈 부족 / 원더 블랙이 아닌 재료는 거부', () => {
  const s = S.createState();
  s.inventory['wb:이그넬라'] = 2;
  s.inventory['wb:카투'] = 2;
  assert.equal(S.synthesizeSweet(s, 'wb:이그넬라', 'wb:이그넬라').error, '루나 크리스탈이 부족합니다.');
  s.lunaCrystal = 1;
  assert.equal(S.synthesizeSweet(s, 'wb:이그넬라', 'wb:카투').ok, false);
  assert.equal(S.synthesizeSweet(s, 'nope', 'wb:이그넬라').ok, false);
  assert.equal(s.inventory['wb:이그넬라'], 2);
  assert.equal(s.lunaCrystal, 1);
});

test('스윗 합성 결과: 쁘띠/키도 지급되고 개수가 누적', () => {
  const s = S.createState();
  s.inventory['wb:이그넬라'] = 4;
  s.lunaCrystal = 2;
  // 표 끝부분(키 1.96%)과 쁘띠 구간을 강제로 뽑는다.
  const rKey = S.synthesizeSweet(s, 'wb:이그넬라', 'wb:이그넬라', () => 0.999);
  assert.equal(rKey.result.kind, Data.KIND.KEY);
  const rPetit = S.synthesizeSweet(s, 'wb:이그넬라', 'wb:이그넬라', () => 0.9);
  assert.equal(rPetit.result.kind, Data.KIND.PETIT);
  assert.equal(s.inventory.key, 1);
});
