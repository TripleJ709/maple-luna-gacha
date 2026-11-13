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
      totalSpent: 0,    // 누적 사용 금액(구매에 쓴 금액, 충전액 제외)
      wonderBerry: 0,   // 보유 원더베리 수
      lunaCrystal: 0,   // 보유 루나 크리스탈 수
      inventory: {}     // 아이템 id -> 개수
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
    if (state.cash < product.price) return { ok: false, error: '캐시가 부족합니다.' };
    state.cash -= product.price;
    state.totalSpent += product.price;
    state[product.field] += product.amount;
    return { ok: true };
  }

  function addItem(state, id, n) {
    state.inventory[id] = (state.inventory[id] || 0) + (n || 1);
  }

  // 원더베리 뽑기: 1회=원더베리 1개, 5회=5개. 부족하면 아무것도 바꾸지 않는다.
  function drawWonderBerry(state, count, rng) {
    if (count !== 1 && count !== 5) return { ok: false, error: '뽑기는 1회 또는 5회만 가능합니다.' };
    if (state.wonderBerry < count) return { ok: false, error: '원더베리가 부족합니다.' };
    state.wonderBerry -= count;
    var results = [];
    for (var i = 0; i < count; i++) {
      var item = Gacha.rollWonderBerry(rng);
      addItem(state, item.id, 1);
      results.push(item);
    }
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
    var needs = {};
    needs[idA] = (needs[idA] || 0) + 1;
    needs[idB] = (needs[idB] || 0) + 1;
    if (!hasItems(state, needs)) return { ok: false, error: '재료가 부족합니다.' };
    if (state.lunaCrystal < 1) return { ok: false, error: '루나 크리스탈이 부족합니다.' };
    removeItems(state, needs);
    state.lunaCrystal -= 1;
    var item = Gacha.rollSweet(rng);
    addItem(state, item.id, 1);
    return { ok: true, result: item };
  }

  // 저장된 값이 깨졌거나 형식이 달라도 기본값으로 안전하게 복구한다.
  function sanitize(raw) {
    var base = createState();
    if (!raw || typeof raw !== 'object') return base;
    ['cash', 'totalSpent', 'wonderBerry', 'lunaCrystal'].forEach(function (k) {
      if (Number.isFinite(raw[k]) && raw[k] >= 0) base[k] = Math.floor(raw[k]);
    });
    if (raw.inventory && typeof raw.inventory === 'object') {
      Object.keys(raw.inventory).forEach(function (id) {
        var n = raw.inventory[id];
        if (Number.isInteger(n) && n > 0) base.inventory[id] = n;
      });
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
    PRODUCTS: PRODUCTS,
    purchase: purchase,
    addItem: addItem,
    drawWonderBerry: drawWonderBerry,
    hasItems: hasItems,
    removeItems: removeItems,
    synthesizeSweet: synthesizeSweet,
    load: load,
    save: save
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameState = api;
})(typeof window !== 'undefined' ? window : globalThis);
