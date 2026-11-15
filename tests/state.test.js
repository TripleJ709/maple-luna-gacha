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
  assert.deepEqual(S.purchase(s, 'wonderBerry1'), { ok: true, totalPrice: 5400, itemAmount: 1 });
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
  S.confirmPending(s);
  const r5 = S.drawWonderBerry(s, 5);
  assert.equal(r5.results.length, 5);
  S.confirmPending(s);
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
  for (let i = 0; i < 60; i++) { S.drawWonderBerry(s, 5); S.confirmPending(s); }
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
  S.confirmPending(s);
  assert.equal(s.inventory[r.result.id], 1);
});

test('스윗 합성: 다른 종류 2개(이그넬라+아쿠엘) 가능', () => {
  const s = S.createState();
  s.inventory['wb:이그넬라'] = 1;
  s.inventory['wb:아쿠엘'] = 3;
  s.lunaCrystal = 2;
  assert.equal(S.synthesizeSweet(s, 'wb:이그넬라', 'wb:아쿠엘').ok, true);
  S.confirmPending(s);
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
  S.confirmPending(s);
  const rPetit = S.synthesizeSweet(s, 'wb:이그넬라', 'wb:이그넬라', () => 0.9);
  assert.equal(rPetit.result.kind, Data.KIND.PETIT);
  S.confirmPending(s);
  assert.equal(s.inventory.key, 1);
});

function dreamSetup() {
  const s = S.createState();
  s.inventory['sweet:프링'] = 1;
  s.inventory['wb:아쿠엘'] = 1;
  s.lunaCrystal = 1;
  return s;
}

test('드림 합성: 재료(스윗 펫, 원더 블랙, 크리스탈) 소모 후 결과 지급', () => {
  const s = dreamSetup();
  const r = S.synthesizeDream(s, 'sweet:프링', 'wb:아쿠엘', seq(0));
  assert.equal(r.ok, true);
  assert.equal(s.inventory['sweet:프링'], undefined);
  assert.equal(s.inventory['wb:아쿠엘'], undefined);
  assert.equal(s.lunaCrystal, 0);
  S.confirmPending(s);
  assert.equal(s.inventory[r.result.id], 1);
});

test('드림 합성: 재료로 쓴 스윗 펫과 같은 종류의 드림 펫은 나오지 않음', () => {
  const rng = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  for (let i = 0; i < 3000; i++) {
    const s = dreamSetup();
    const r = S.synthesizeDream(s, 'sweet:프링', 'wb:아쿠엘', rng);
    S.confirmPending(s);
    assert.ok(!(r.result.kind === Data.KIND.DREAM_PET && r.result.name === '프링'));
  }
});

test('드림 합성: 드림 펫/쁘띠/스윗 두 개는 재료로 불가', () => {
  const s = dreamSetup();
  s.inventory['dream:레옹'] = 1;
  s.inventory['sweet:주니'] = 1;
  s.inventory['petit:백야'] = 1;
  assert.equal(S.synthesizeDream(s, 'dream:레옹', 'wb:아쿠엘').ok, false);
  assert.equal(S.synthesizeDream(s, 'petit:백야', 'wb:아쿠엘').ok, false);
  assert.equal(S.synthesizeDream(s, 'sweet:프링', 'sweet:주니').ok, false);
  assert.equal(s.lunaCrystal, 1);
  assert.equal(s.inventory['wb:아쿠엘'], 1);
});

test('드림 합성: 재료/크리스탈 부족은 거부하고 상태 불변', () => {
  const s = dreamSetup();
  s.lunaCrystal = 0;
  const before = JSON.stringify(s);
  assert.equal(S.synthesizeDream(s, 'sweet:프링', 'wb:아쿠엘').error, '루나 크리스탈이 부족합니다.');
  s.lunaCrystal = 1;
  delete s.inventory['wb:아쿠엘'];
  assert.equal(S.synthesizeDream(s, 'sweet:프링', 'wb:아쿠엘').error, '재료가 부족합니다.');
  assert.equal(s.inventory['sweet:프링'], 1);
});

test('드림 합성 결과(드림 펫)는 인벤토리에 쌓이지만 다시 드림 재료가 될 수 없음', () => {
  const s = dreamSetup();
  const r = S.synthesizeDream(s, 'sweet:프링', 'wb:아쿠엘', seq(0));
  assert.equal(r.result.kind, Data.KIND.DREAM_PET);
  S.confirmPending(s);
  s.inventory['wb:이그넬라'] = 1;
  s.lunaCrystal = 1;
  assert.equal(S.synthesizeDream(s, r.result.id, 'wb:이그넬라').ok, false);
});

test('확인 전에는 인벤토리에 반영되지 않고, 확인하면 반영되어 대기가 비워짐', () => {
  const s = S.createState();
  s.wonderBerry = 5;
  const r = S.drawWonderBerry(s, 5);
  assert.deepEqual(s.inventory, {});
  assert.equal(s.pending.ids.length, 5);
  const c = S.confirmPending(s);
  assert.equal(c.ok, true);
  assert.equal(c.items.length, 5);
  assert.equal(s.pending, null);
  assert.equal(Object.values(s.inventory).reduce((a, b) => a + b, 0), 5);
  assert.deepEqual(S.confirmPending(s), { ok: false, items: [] }); // 이중 확인 방지
});

test('대기 결과가 있으면 새 뽑기/합성은 거부 (재료도 소모되지 않음)', () => {
  const s = S.createState();
  s.wonderBerry = 6;
  s.lunaCrystal = 1;
  s.inventory['wb:이그넬라'] = 2;
  S.drawWonderBerry(s, 1);
  const before = JSON.stringify(s);
  assert.equal(S.drawWonderBerry(s, 1).error, '이전 결과를 먼저 확인해 주세요.');
  assert.equal(S.synthesizeSweet(s, 'wb:이그넬라', 'wb:이그넬라').ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('대기 결과는 저장/복구되어 새로고침 후에도 유지, 깨진 id는 제거', () => {
  const st = memoryStorage();
  const s = S.createState();
  s.wonderBerry = 1;
  S.drawWonderBerry(s, 1);
  S.save(st, s);
  assert.deepEqual(S.load(st).pending, s.pending);
  const bad = JSON.stringify({ pending: { title: 't', ids: ['nope', 'key'] } });
  assert.deepEqual(S.load(memoryStorage(bad)).pending, { title: 't', ids: ['key'] });
  assert.equal(S.load(memoryStorage(JSON.stringify({ pending: { title: 't', ids: ['nope'] } }))).pending, null);
});

test('초기화: 모든 필드(캐시, 인벤토리, 통계, 기록, 대기 결과)가 처음 상태로 돌아감', () => {
  const s = S.createState();
  S.charge(s, 100000);
  S.purchase(s, 'wonderBerry11');
  S.purchase(s, 'lunaCrystal1');
  S.drawWonderBerry(s, 5);
  const keysBefore = Object.keys(S.createState()).sort();
  S.reset(s);
  assert.deepEqual(s, S.createState());
  assert.deepEqual(Object.keys(s).sort(), keysBefore);
});

test('초기화 후 저장하면 다시 불러와도 처음 상태', () => {
  const st = memoryStorage();
  const s = S.createState();
  S.charge(s, 50000);
  S.save(st, s);
  S.reset(s);
  S.save(st, s);
  assert.deepEqual(S.load(st), S.createState());
});

test('합성 종류: 블랙+블랙=스윗, 스윗펫+블랙=드림(순서 무관), 스윗펫+스윗펫=불가', () => {
  assert.equal(S.synthModeOf('wb:이그넬라', 'wb:아쿠엘'), 'sweet');
  assert.equal(S.synthModeOf('wb:이그넬라', 'wb:이그넬라'), 'sweet');
  assert.equal(S.synthModeOf('sweet:프링', 'wb:아쿠엘'), 'dream');
  assert.equal(S.synthModeOf('wb:아쿠엘', 'sweet:프링'), 'dream');
  assert.equal(S.synthModeOf('sweet:프링', 'sweet:주니'), null);
  assert.equal(S.synthModeOf('dream:레옹', 'wb:아쿠엘'), null);
  assert.equal(S.synthModeOf('petit:백야', 'wb:아쿠엘'), null);
});

test('합성 창: 원더 블랙/스윗 펫만 선택 가능, 그 외(상급, 드림, 쁘띠, 키)는 불가', () => {
  const s = S.createState();
  s.inventory = { 'wb:이그넬라': 1, 'wb:카투': 1, 'sweet:프링': 1, 'dream:레옹': 1, 'petit:백야': 1, key: 1 };
  assert.equal(S.canSelect(s, [null, null], 'wb:이그넬라'), true);
  assert.equal(S.canSelect(s, [null, null], 'sweet:프링'), true);
  ['wb:카투', 'dream:레옹', 'petit:백야', 'key', 'nope'].forEach((id) => {
    assert.equal(S.canSelect(s, [null, null], id), false, id);
  });
});

test('합성 창: 첫 칸이 스윗 펫이면 둘째 칸에 스윗 펫 불가(블랙만), 첫 칸이 블랙이면 둘 다 가능', () => {
  const s = S.createState();
  s.inventory = { 'wb:이그넬라': 2, 'wb:아쿠엘': 1, 'sweet:프링': 1, 'sweet:주니': 1 };
  assert.equal(S.canSelect(s, ['sweet:프링', null], 'sweet:주니'), false);
  assert.equal(S.canSelect(s, ['sweet:프링', null], 'wb:이그넬라'), true);
  assert.equal(S.canSelect(s, ['wb:이그넬라', null], 'wb:아쿠엘'), true);
  assert.equal(S.canSelect(s, ['wb:이그넬라', null], 'sweet:프링'), true);
  assert.equal(S.canSelect(s, [null, 'sweet:프링'], 'sweet:주니'), false); // 둘째 칸에 먼저 넣은 경우도 동일
});

test('합성 창: 보유 수량 초과/칸이 가득 찬 경우 선택 불가', () => {
  const s = S.createState();
  s.inventory = { 'wb:이그넬라': 1, 'wb:아쿠엘': 2 };
  assert.equal(S.canSelect(s, ['wb:이그넬라', null], 'wb:이그넬라'), false); // 1개뿐
  assert.equal(S.canSelect(s, ['wb:아쿠엘', null], 'wb:아쿠엘'), true);       // 2개 보유
  assert.equal(S.canSelect(s, ['wb:아쿠엘', 'wb:아쿠엘'], 'wb:이그넬라'), false); // 칸이 가득 참
  assert.equal(S.firstOpenSlot([null, null]), 0);
  assert.equal(S.firstOpenSlot(['a', null]), 1);
  assert.equal(S.firstOpenSlot(['a', 'b']), -1);
});

test('합성 창 실행: 칸이 비거나 불가 조합이면 거부, 성공 시 합성 종류를 알려주고 크리스탈 소모', () => {
  const s = S.createState();
  s.inventory = { 'wb:이그넬라': 1, 'wb:아쿠엘': 1, 'sweet:프링': 1, 'sweet:주니': 1 };
  s.lunaCrystal = 3;
  assert.equal(S.runSynthesis(s, ['wb:이그넬라', null]).ok, false);
  assert.equal(S.runSynthesis(s, ['sweet:프링', 'sweet:주니']).ok, false);
  assert.equal(s.lunaCrystal, 3);
  const r1 = S.runSynthesis(s, ['wb:이그넬라', 'wb:아쿠엘'], () => 0);
  assert.deepEqual([r1.ok, r1.mode, s.lunaCrystal], [true, 'sweet', 2]);
  S.confirmPending(s);
  s.inventory['wb:아쿠엘'] = 1;
  const r2 = S.runSynthesis(s, ['wb:아쿠엘', 'sweet:프링'], () => 0); // 순서가 바뀌어도 드림
  assert.deepEqual([r2.ok, r2.mode, s.lunaCrystal], [true, 'dream', 1]);
  assert.equal(r2.result.kind, Data.KIND.DREAM_PET);
});

test('페이백: 상급 펫 1개당 540P(원더베리 5,400원의 10%), 펫은 사라지고 누적 페이백 증가', () => {
  assert.equal(Data.PAYBACK_POINT, 540);
  const s = S.createState();
  s.inventory = { 'wb:카투': 3 };
  assert.deepEqual(S.payback(s, 'wb:카투'), { ok: true, point: 540 });
  assert.equal(s.inventory['wb:카투'], 2);
  assert.equal(s.maplePoint, 540);
  assert.deepEqual(S.payback(s, 'wb:카투', 2), { ok: true, point: 1080 });
  assert.equal(s.inventory['wb:카투'], undefined);
  assert.equal(s.maplePoint, 1620);
  assert.equal(s.totalPayback, 1620);
});

test('페이백 대상은 상급 펫 5종뿐: 원더 블랙, 소비 아이템, 스윗/드림/쁘띠/키는 불가', () => {
  const s = S.createState();
  const ok = ['카투', '카티엘', '파라키', '쿠키베어', '뚠냥'];
  ok.forEach((n) => { s.inventory['wb:' + n] = 1; assert.equal(S.payback(s, 'wb:' + n).ok, true, n); });
  ['wb:이그넬라', 'wb:오가닉 원더 쿠키', 'wb:고농축 프리미엄 생명의 물', 'sweet:프링', 'dream:레옹', 'petit:백야', 'key', 'nope'].forEach((id) => {
    s.inventory[id] = 1;
    assert.equal(S.payback(s, id).ok, false, id);
    assert.equal(s.inventory[id], 1, id + ' 불변');
  });
});

test('페이백: 수량 부족/잘못된 수량은 거부하고 상태 불변', () => {
  const s = S.createState();
  s.inventory = { 'wb:뚠냥': 1 };
  const before = JSON.stringify(s);
  assert.equal(S.payback(s, 'wb:뚠냥', 2).ok, false);
  [0, -1, 1.5, NaN].forEach((c) => assert.equal(S.payback(s, 'wb:뚠냥', c).ok, false, String(c)));
  assert.equal(S.payback(s, 'wb:카투').ok, false);
  assert.equal(JSON.stringify(s), before);
});

test('결제 수단을 선택해 전액 결제하며 캐시와 메이플포인트를 섞지 않음', () => {
  const s = S.createState();
  s.maplePoint = 5400;
  s.cash = 5000;
  assert.equal(S.purchase(s, 'wonderBerry1', 'cash').error, '캐시가 부족합니다.');
  assert.deepEqual([s.maplePoint, s.cash], [5400, 5000]);
  assert.equal(S.purchase(s, 'wonderBerry1', 'maplePoint').ok, true);
  assert.deepEqual([s.maplePoint, s.cash, s.wonderBerry], [0, 5000, 1]);
});

test('구매 수량만큼 가격과 지급 수량을 곱해 계산', () => {
  const s = S.createState();
  s.cash = 200000;
  const r = S.purchase(s, 'wonderBerry11', 'cash', 3);
  assert.deepEqual(r, { ok: true, totalPrice: 162000, itemAmount: 33 });
  assert.equal(s.cash, 38000);
  assert.equal(s.wonderBerry, 33);
  assert.equal(s.totalSpent, 162000);
});

test('구매 수량은 1~100 정수, 결제 수단은 캐시/메이플포인트만 허용', () => {
  const s = S.createState();
  s.cash = 1000000;
  s.maplePoint = 1000000;
  [0, -1, 1.5, 101, '2', NaN].forEach((q) => assert.equal(S.purchase(s, 'lunaCrystal1', 'cash', q).ok, false));
  assert.equal(S.purchase(s, 'lunaCrystal1', 'mixed', 1).ok, false);
  assert.deepEqual([s.cash, s.maplePoint, s.lunaCrystal], [1000000, 1000000, 0]);
});

test('선택한 결제 수단이 부족하면 다른 재화가 충분해도 거부', () => {
  const s = S.createState();
  s.maplePoint = 2000;
  s.cash = 100000;
  const before = JSON.stringify(s);
  assert.equal(S.purchase(s, 'wonderBerry1', 'maplePoint').error, '메이플포인트가 부족합니다.');
  assert.equal(JSON.stringify(s), before);
});

test('메이플포인트/누적 페이백은 저장·복구되고 초기화로 0이 됨, 깨진 값은 0', () => {
  const st = memoryStorage();
  const s = S.createState();
  s.inventory = { 'wb:파라키': 1 };
  S.payback(s, 'wb:파라키');
  S.save(st, s);
  const l = S.load(st);
  assert.deepEqual([l.maplePoint, l.totalPayback], [540, 540]);
  S.reset(s);
  assert.deepEqual([s.maplePoint, s.totalPayback], [0, 0]);
  assert.equal(S.load(memoryStorage(JSON.stringify({ maplePoint: -1, totalPayback: 'x' }))).maplePoint, 0);
});
