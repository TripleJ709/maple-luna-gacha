/*
 * 게임 상태와 저장(localStorage). 순수 함수 위주로 만들어 Node에서 테스트할 수 있다.
 * 상태 변경 함수는 { ok, error? } 를 돌려주고, 성공 시 state를 직접 갱신한다.
 */
(function (root) {
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
    load: load,
    save: save
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameState = api;
})(typeof window !== 'undefined' ? window : globalThis);
