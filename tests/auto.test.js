const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/state.js');
const Auto = require('../js/auto.js');

function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BIG = 1e9;

test('스윗 전략: 쁘띠가 나올 때까지 반복하고 사용 금액이 누적 사용 금액과 일치', () => {
  const s = S.createState();
  const r = Auto.run(s, { strategy: 'sweet', spendLimit: BIG }, seeded(1));
  assert.equal(r.success, true);
  assert.equal(r.found.kind, 'petit');
  assert.equal(r.spent, s.totalSpent);
  assert.ok(r.sweets >= 1 && r.draws >= 2);
  assert.ok(s.cash >= 0 && s.wonderBerry >= 0 && s.lunaCrystal >= 0);
  assert.equal(s.pending, null);
});

test('특정 쁘띠(백야)를 목표로 하면 백야가 나올 때 종료', () => {
  const s = S.createState();
  const r = Auto.run(s, { strategy: 'sweet', target: 'petit:백야', spendLimit: BIG }, seeded(5));
  assert.equal(r.success, true);
  assert.equal(r.found.id, 'petit:백야');
});

test('드림 전략: 성공 시 쁘띠, 드림 합성 횟수 기록', () => {
  const s = S.createState();
  const r = Auto.run(s, { strategy: 'dream', spendLimit: BIG }, seeded(9));
  assert.equal(r.success, true);
  assert.equal(r.found.kind, 'petit');
  assert.equal(r.spent, s.totalSpent);
  assert.ok(r.sweets >= 1);
});

test('한도 도달 시 한도를 넘기지 않고 중단', () => {
  const s = S.createState();
  const r = Auto.run(s, { strategy: 'sweet', spendLimit: 200000 }, () => 0); // 항상 첫 항목: 쁘띠 불가
  assert.equal(r.success, false);
  assert.equal(r.reason, 'limit');
  assert.ok(r.spent <= 200000);
  assert.equal(r.spent, s.totalSpent);
});

test('이미 가진 재료를 먼저 사용하고, 시작 시점의 누적 사용 금액은 제외하고 계산', () => {
  const s = S.createState();
  s.totalSpent = 777000;
  s.inventory['wb:이그넬라'] = 2;
  s.lunaCrystal = 1;
  const r = Auto.run(s, { strategy: 'sweet', spendLimit: BIG }, () => 0.9); // 0.9는 쁘띠 구간
  assert.equal(r.success, true);
  assert.equal(r.spent, 0);
  assert.equal(r.draws, 0);
  assert.equal(s.totalSpent, 777000);
});

test('잘못된 옵션/대기 결과가 있으면 실행하지 않음', () => {
  const s = S.createState();
  assert.equal(Auto.run(s, { strategy: 'x', spendLimit: BIG }).reason, 'invalid');
  assert.equal(Auto.run(s, { strategy: 'sweet', spendLimit: 0 }).reason, 'invalid');
  s.wonderBerry = 1;
  S.drawWonderBerry(s, 1);
  assert.equal(Auto.run(s, { strategy: 'sweet', spendLimit: BIG }).reason, 'pending');
});
