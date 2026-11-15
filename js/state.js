/*
 * 게임 상태와 저장(localStorage). 순수 함수 위주로 만들어 Node에서 테스트할 수 있다.
 * 상태 변경 함수는 { ok, error? } 를 돌려주고, 성공 시 state를 직접 갱신한다.
 */
(function (root) {
  var Data = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.GachaData;
  var Gacha = typeof module !== 'undefined' && module.exports ? require('./gacha.js') : root.Gacha;
  var STORAGE_KEY = 'mapleLunaGacha.v1';
  var CHARGE_MIN = 10000;
  var CHARGE_MAX = 1000000;
  var CHARGE_UNIT = 10000;

  function createState() {
    return {
      cash: 0,          // 현재 캐시(원)
      maplePoint: 0,    // 메이플포인트(P). 캐시와 똑같이 쓸 수 있다. (페이백으로 지급)
      totalPayback: 0,  // 누적 페이백 금액(P)
      totalSpent: 0,    // 누적 사용 금액(구매에 쓴 금액, 충전액 제외)
      wonderBerry: 0,   // 보유 원더베리 수
      lunaCrystal: 0,   // 보유 루나 크리스탈 수
      inventory: {},    // 아이템 id -> 개수
      stats: { draw: {}, sweet: {}, dream: {} }, // 출처별 결과 아이템 id -> 획득 횟수
      history: [],      // 최근 기록(최신이 앞). { time, source, ids }
      pending: null     // 확인 대기 중인 결과 { title, ids }. 확인 전에는 인벤토리에 반영되지 않는다.
    };
  }

  // 충전: 10,000 ~ 1,000,000원, 10,000원 단위. 현재 캐시에 더하기만 한다.
  function charge(state, amount) {
    if (!Number.isInteger(amount) || amount < CHARGE_MIN || amount > CHARGE_MAX || amount % CHARGE_UNIT !== 0) {
      return { ok: false, error: '충전 금액은 10,000원 ~ 1,000,000원 사이(10,000원 단위)여야 합니다.' };
    }
    state.cash += amount;
    return { ok: true };
  }

  // 판매 상품: 가격(원)과 지급 수량. 가격은 data.js의 PRICES 기준.
  var PRODUCTS = {
    wonderBerry1: { label: '원더베리 1개', field: 'wonderBerry', amount: 1, price: Data.PRICES.wonderBerry1 },
    wonderBerry11: { label: '원더베리 11개', field: 'wonderBerry', amount: 11, price: Data.PRICES.wonderBerry11 },
    lunaCrystal1: { label: '루나 크리스탈 1개', field: 'lunaCrystal', amount: 1, price: Data.PRICES.lunaCrystal1 }
  };

  // 구매: 캐시 차감 + 누적 사용 금액 증가 + 재화 지급. 캐시가 부족하면 아무것도 바꾸지 않는다.
  function purchase(state, productId) {
    var product = Object.prototype.hasOwnProperty.call(PRODUCTS, productId) ? PRODUCTS[productId] : null;
    if (!product) return { ok: false, error: '알 수 없는 상품입니다.' };
    // 메이플포인트는 캐시와 똑같이 쓸 수 있다. 메이플포인트를 먼저 쓰고 모자란 만큼 캐시를 쓴다.
    if (state.cash + state.maplePoint < product.price) return { ok: false, error: '캐시가 부족합니다.' };
    var byPoint = Math.min(state.maplePoint, product.price);
    state.maplePoint -= byPoint;
    state.cash -= product.price - byPoint;
    state.totalSpent += product.price;
    state[product.field] += product.amount;
    return { ok: true };
  }

  // 페이백: 인벤토리의 원더 펫(상급 5종)을 count개 돌려주고 메이플포인트를 받는다. (1개당 540P)
  function payback(state, id, count) {
    var item = Data.ITEM_INDEX[id];
    count = count === undefined ? 1 : count;
    if (!item || !item.payback) return { ok: false, error: '페이백할 수 없는 아이템입니다.' };
    if (!Number.isInteger(count) || count < 1) return { ok: false, error: '수량이 올바르지 않습니다.' };
    if ((state.inventory[id] || 0) < count) return { ok: false, error: '보유 수량이 부족합니다.' };
    var needs = {};
    needs[id] = count;
    removeItems(state, needs);
    var point = item.payback * count;
    state.maplePoint += point;
    state.totalPayback += point;
    return { ok: true, point: point };
  }

  function addItem(state, id, n) {
    state.inventory[id] = (state.inventory[id] || 0) + (n || 1);
  }

  var HISTORY_LIMIT = 50;

  // 통계와 기록에 남긴다. source: 'draw' | 'sweet' | 'dream'
  function recordResult(state, source, items) {
    items.forEach(function (it) {
      state.stats[source][it.id] = (state.stats[source][it.id] || 0) + 1;
    });
    state.history.unshift({ time: Date.now(), source: source, ids: items.map(function (it) { return it.id; }) });
    if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
  }

  var PENDING_ERROR = '이전 결과를 먼저 확인해 주세요.';

  // 결과를 인벤토리에 바로 넣지 않고 확인 대기 상태로 둔다.
  function setPending(state, title, items) {
    state.pending = { title: title, ids: items.map(function (it) { return it.id; }) };
  }

  // 확인: 대기 중인 결과를 인벤토리에 반영한다. 대기 결과가 없으면 아무 일도 하지 않는다.
  function confirmPending(state) {
    if (!state.pending) return { ok: false, items: [] };
    var items = state.pending.ids.map(function (id) { return Data.ITEM_INDEX[id]; });
    state.pending.ids.forEach(function (id) { addItem(state, id, 1); });
    state.pending = null;
    return { ok: true, items: items };
  }

  // 원더베리 뽑기: 1회=원더베리 1개, 5회=5개. 부족하면 아무것도 바꾸지 않는다.
  function drawWonderBerry(state, count, rng) {
    if (count !== 1 && count !== 5) return { ok: false, error: '뽑기는 1회 또는 5회만 가능합니다.' };
    if (state.pending) return { ok: false, error: PENDING_ERROR };
    if (state.wonderBerry < count) return { ok: false, error: '원더베리가 부족합니다.' };
    state.wonderBerry -= count;
    var results = [];
    for (var i = 0; i < count; i++) {
      results.push(Gacha.rollWonderBerry(rng));
    }
    setPending(state, '뽑기 결과', results);
    recordResult(state, 'draw', results);
    return { ok: true, results: results };
  }

  // 인벤토리에서 재료 수량을 확인하고 한 번에 소모한다. needs: { id: 필요 개수 }
  function hasItems(state, needs) {
    return Object.keys(needs).every(function (id) { return (state.inventory[id] || 0) >= needs[id]; });
  }

  function removeItems(state, needs) {
    Object.keys(needs).forEach(function (id) {
      state.inventory[id] -= needs[id];
      if (state.inventory[id] <= 0) delete state.inventory[id];
    });
  }

  function isKind(id, kind) {
    var it = Data.ITEM_INDEX[id];
    return !!it && it.kind === kind;
  }

  // 스윗 합성: 원더 블랙 2개(종류 무관, 같은 종류 2개도 가능) + 루나 크리스탈 1개.
  // 결과: 루나 스윗 펫 / 루나 쁘띠 / 루나 크리스탈 키. 실패 시 상태는 바뀌지 않는다.
  function synthesizeSweet(state, idA, idB, rng) {
    if (!isKind(idA, Data.KIND.WONDER_BLACK) || !isKind(idB, Data.KIND.WONDER_BLACK)) {
      return { ok: false, error: '원더 블랙 펫 2개를 선택해야 합니다.' };
    }
    if (state.pending) return { ok: false, error: PENDING_ERROR };
    var needs = {};
    needs[idA] = (needs[idA] || 0) + 1;
    needs[idB] = (needs[idB] || 0) + 1;
    if (!hasItems(state, needs)) return { ok: false, error: '재료가 부족합니다.' };
    if (state.lunaCrystal < 1) return { ok: false, error: '루나 크리스탈이 부족합니다.' };
    removeItems(state, needs);
    state.lunaCrystal -= 1;
    var item = Gacha.rollSweet(rng);
    setPending(state, '스윗 합성 결과', [item]);
    recordResult(state, 'sweet', [item]);
    return { ok: true, result: item };
  }

  // 드림 합성: 스윗 펫 1개(베이스) + 원더 블랙 1개 + 루나 크리스탈 1개.
  // 베이스와 같은 이름의 드림 펫은 나오지 않는다. 드림 펫은 재료로 쓸 수 없다. 실패 시 상태는 바뀌지 않는다.
  function synthesizeDream(state, sweetId, blackId, rng) {
    if (!isKind(sweetId, Data.KIND.SWEET_PET)) return { ok: false, error: '루나 스윗 펫을 선택해야 합니다.' };
    if (!isKind(blackId, Data.KIND.WONDER_BLACK)) return { ok: false, error: '원더 블랙 펫을 선택해야 합니다.' };
    if (state.pending) return { ok: false, error: PENDING_ERROR };
    var needs = {};
    needs[sweetId] = 1;
    needs[blackId] = 1;
    if (!hasItems(state, needs)) return { ok: false, error: '재료가 부족합니다.' };
    if (state.lunaCrystal < 1) return { ok: false, error: '루나 크리스탈이 부족합니다.' };
    removeItems(state, needs);
    state.lunaCrystal -= 1;
    var item = Gacha.rollDream(Data.ITEM_INDEX[sweetId].name, rng);
    setPending(state, '드림 합성 결과', [item]);
    recordResult(state, 'dream', [item]);
    return { ok: true, result: item };
  }

  // 초기화: createState()의 값으로 모든 필드를 되돌린다. (새 상태 필드를 추가해도 자동으로 포함된다)
  function reset(state) {
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.assign(state, createState());
  }

  /*
   * 합성 창(재료 2칸) 규칙. 칸 순서는 상관없고, 조합으로 합성 종류가 정해진다.
   *  - 원더 블랙 + 원더 블랙 -> 스윗 합성
   *  - 루나 스윗 펫 + 원더 블랙 -> 드림 합성
   *  - 루나 스윗 펫 + 루나 스윗 펫 -> 불가
   */
  function kindOf(id) {
    var it = Data.ITEM_INDEX[id];
    return it ? it.kind : null;
  }

  // 두 재료의 합성 종류: 'sweet' | 'dream' | null(불가)
  function synthModeOf(idA, idB) {
    var a = kindOf(idA), b = kindOf(idB);
    var BLACK = Data.KIND.WONDER_BLACK, SWEET = Data.KIND.SWEET_PET;
    if (a === BLACK && b === BLACK) return 'sweet';
    if ((a === SWEET && b === BLACK) || (a === BLACK && b === SWEET)) return 'dream';
    return null;
  }

  // selected: 칸별 선택된 아이템 id (비어 있으면 null). 첫 빈 칸의 번호, 없으면 -1.
  function firstOpenSlot(selected) {
    for (var i = 0; i < selected.length; i++) if (!selected[i]) return i;
    return -1;
  }

  // 이 아이템을 지금 선택할 수 있는가: 원더 블랙/스윗 펫이어야 하고, 빈 칸과 보유 수량이 있어야 하며,
  // 이미 고른 재료와 합성이 가능한 조합이어야 한다.
  function canSelect(state, selected, id) {
    var kind = kindOf(id);
    if (kind !== Data.KIND.WONDER_BLACK && kind !== Data.KIND.SWEET_PET) return false;
    if (firstOpenSlot(selected) === -1) return false;
    var used = selected.filter(function (x) { return x === id; }).length;
    if ((state.inventory[id] || 0) <= used) return false;
    var other = selected.filter(Boolean)[0];
    return other ? synthModeOf(other, id) !== null : true;
  }

  // 칸이 모두 찼을 때 합성을 실행한다. (루나 크리스탈 1개는 이때 소모된다)
  // 반환: { ok, result, mode } 또는 { ok:false, error }
  function runSynthesis(state, selected, rng) {
    if (selected.length !== 2 || !selected[0] || !selected[1]) return { ok: false, error: '재료를 모두 넣어 주세요.' };
    var mode = synthModeOf(selected[0], selected[1]);
    if (!mode) return { ok: false, error: '이 재료로는 합성할 수 없습니다.' };
    var r;
    if (mode === 'sweet') {
      r = synthesizeSweet(state, selected[0], selected[1], rng);
    } else {
      var sweetId = kindOf(selected[0]) === Data.KIND.SWEET_PET ? selected[0] : selected[1];
      var blackId = sweetId === selected[0] ? selected[1] : selected[0];
      r = synthesizeDream(state, sweetId, blackId, rng);
    }
    return r.ok ? { ok: true, result: r.result, mode: mode } : r;
  }

  // 저장된 값이 깨졌거나 형식이 달라도 기본값으로 안전하게 복구한다.
  function sanitize(raw) {
    var base = createState();
    if (!raw || typeof raw !== 'object') return base;
    ['cash', 'maplePoint', 'totalPayback', 'totalSpent', 'wonderBerry', 'lunaCrystal'].forEach(function (k) {
      if (Number.isFinite(raw[k]) && raw[k] >= 0) base[k] = Math.floor(raw[k]);
    });
    if (raw.inventory && typeof raw.inventory === 'object') {
      Object.keys(raw.inventory).forEach(function (id) {
        var n = raw.inventory[id];
        if (Number.isInteger(n) && n > 0) base.inventory[id] = n;
      });
    }
    ['draw', 'sweet', 'dream'].forEach(function (src) {
      var st = raw.stats && raw.stats[src];
      if (!st || typeof st !== 'object') return;
      Object.keys(st).forEach(function (id) {
        if (Object.prototype.hasOwnProperty.call(Data.ITEM_INDEX, id) && Number.isInteger(st[id]) && st[id] > 0) base.stats[src][id] = st[id];
      });
    });
    if (Array.isArray(raw.history)) {
      raw.history.slice(0, HISTORY_LIMIT).forEach(function (h) {
        if (!h || !Number.isFinite(h.time) || !base.stats.hasOwnProperty(h.source) || !Array.isArray(h.ids)) return;
        var ids = h.ids.filter(function (id) { return Object.prototype.hasOwnProperty.call(Data.ITEM_INDEX, id); });
        if (ids.length) base.history.push({ time: h.time, source: h.source, ids: ids });
      });
    }
    var pend = raw.pending;
    if (pend && typeof pend.title === 'string' && Array.isArray(pend.ids)) {
      var ids = pend.ids.filter(function (id) { return Object.prototype.hasOwnProperty.call(Data.ITEM_INDEX, id); });
      if (ids.length) base.pending = { title: pend.title, ids: ids };
    }
    return base;
  }

  function load(storage) {
    try {
      var text = storage.getItem(STORAGE_KEY);
      return text ? sanitize(JSON.parse(text)) : createState();
    } catch (e) {
      return createState();
    }
  }

  function save(storage, state) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 시 무시 */ }
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    CHARGE_MIN: CHARGE_MIN,
    CHARGE_MAX: CHARGE_MAX,
    CHARGE_UNIT: CHARGE_UNIT,
    createState: createState,
    charge: charge,
    reset: reset,
    PRODUCTS: PRODUCTS,
    purchase: purchase,
    addItem: addItem,
    payback: payback,
    confirmPending: confirmPending,
    HISTORY_LIMIT: HISTORY_LIMIT,
    drawWonderBerry: drawWonderBerry,
    hasItems: hasItems,
    removeItems: removeItems,
    synthesizeSweet: synthesizeSweet,
    synthesizeDream: synthesizeDream,
    synthModeOf: synthModeOf,
    firstOpenSlot: firstOpenSlot,
    canSelect: canSelect,
    runSynthesis: runSynthesis,
    load: load,
    save: save
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameState = api;
})(typeof window !== 'undefined' ? window : globalThis);
