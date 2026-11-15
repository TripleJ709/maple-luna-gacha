/*
 * 자동 반복 합성: 목표 루나 쁘띠가 나올 때까지 실제 게임 규칙 그대로 반복한다.
 * - 재료나 재화가 모자라면 자동으로 구매한다. (원더베리는 11개 묶음, 루나 크리스탈은 1개)
 * - 캐시가 부족하면 필요한 만큼 10,000원 단위로 자동 충전한다. (충전액은 누적 사용 금액에 포함되지 않음)
 * - 이번 실행에서 쓴 금액이 한도를 넘게 되면 구매 전에 멈춘다.
 * strategy: 'sweet' 스윗 합성만 반복 / 'dream' 스윗 펫을 얻은 뒤 드림 합성으로 도전
 */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Data = isNode ? require('./data.js') : root.GachaData;
  var State = isNode ? require('./state.js') : root.GameState;

  var MAX_STEPS = 5000; // 무한 반복 방지용 안전장치
  var K = Data.KIND;

  function countKind(state, kind) {
    return Object.keys(state.inventory).reduce(function (n, id) {
      return Data.ITEM_INDEX[id].kind === kind ? n + state.inventory[id] : n;
    }, 0);
  }

  // 인벤토리에서 해당 종류 아이템 id를 개수만큼 고른다 (종류 무관).
  function pickIds(state, kind, n) {
    var ids = [];
    Object.keys(state.inventory).forEach(function (id) {
      if (Data.ITEM_INDEX[id].kind !== kind) return;
      for (var i = 0; i < state.inventory[id] && ids.length < n; i++) ids.push(id);
    });
    return ids;
  }

  function run(state, options, rng) {
    var strategy = options.strategy;
    var target = options.target || 'any'; // 'any' 또는 쁘띠 id (예: 'petit:백야')
    var limit = options.spendLimit;
    var startSpent = state.totalSpent;
    var summary = { success: false, reason: '', spent: 0, draws: 0, sweets: 0, dreams: 0, purchases: 0, found: null };

    if (strategy !== 'sweet' && strategy !== 'dream') return Object.assign(summary, { reason: 'invalid' });
    if (state.pending) return Object.assign(summary, { reason: 'pending' });
    if (!Number.isFinite(limit) || limit <= 0) return Object.assign(summary, { reason: 'invalid' });

    // 상품 구매. 한도를 넘으면 구매하지 않고 false를 돌려준다.
    function buy(productId) {
      var product = State.PRODUCTS[productId];
      if (state.totalSpent - startSpent + product.price > limit) return false;
      if (state.cash + state.maplePoint < product.price) {
        var shortage = product.price - state.cash - state.maplePoint;
        State.charge(state, Math.ceil(shortage / State.CHARGE_UNIT) * State.CHARGE_UNIT);
      }
      State.purchase(state, productId);
      summary.purchases++;
      return true;
    }

    function ensureCrystal() { return state.lunaCrystal >= 1 || buy('lunaCrystal1'); }

    // 원더 블랙이 need개 이상이 될 때까지 원더베리를 1개씩 뽑는다.
    function ensureBlacks(need) {
      while (countKind(state, K.WONDER_BLACK) < need) {
        if (state.wonderBerry < 1 && !buy('wonderBerry11')) return false;
        State.drawWonderBerry(state, 1, rng);
        State.confirmPending(state);
        summary.draws++;
      }
      return true;
    }

    function isHit(item) { return item.kind === K.PETIT && (target === 'any' || item.id === target); }

    function stepSweet() {
      if (!ensureBlacks(2) || !ensureCrystal()) return null;
      var ids = pickIds(state, K.WONDER_BLACK, 2);
      var r = State.synthesizeSweet(state, ids[0], ids[1], rng);
      State.confirmPending(state);
      summary.sweets++;
      return r.result;
    }

    function stepDream() {
      if (countKind(state, K.SWEET_PET) < 1) {
        var got = stepSweet();
        if (!got) return null;
        if (isHit(got)) return got;
        if (got.kind !== K.SWEET_PET) return got; // 쁘띠(목표 아님)/키: 다음 반복에서 다시 스윗 합성
      }
      if (!ensureBlacks(1) || !ensureCrystal()) return null;
      var r = State.synthesizeDream(state, pickIds(state, K.SWEET_PET, 1)[0], pickIds(state, K.WONDER_BLACK, 1)[0], rng);
      State.confirmPending(state);
      summary.dreams++;
      return r.result;
    }

    for (var i = 0; i < MAX_STEPS; i++) {
      var item = strategy === 'sweet' ? stepSweet() : stepDream();
      if (!item) { summary.reason = 'limit'; break; }
      if (isHit(item)) { summary.success = true; summary.reason = 'hit'; summary.found = item; break; }
    }
    if (!summary.reason) summary.reason = 'maxSteps';
    summary.spent = state.totalSpent - startSpent;
    return summary;
  }

  var api = { run: run, MAX_STEPS: MAX_STEPS };
  if (isNode) module.exports = api;
  else root.AutoSynth = api;
})(typeof window !== 'undefined' ? window : globalThis);
