/* 화면 연결. 상태는 GameState에서 관리하고, 여기서는 표시와 이벤트만 다룬다. */
(function () {
  var state = GameState.load(window.localStorage);

  var els = {
    cash: document.getElementById('cash'),
    totalSpent: document.getElementById('total-spent'),
    amount: document.getElementById('charge-amount'),
    chargeBtn: document.getElementById('charge-btn'),
    message: document.getElementById('message'),
    wonderBerry: document.getElementById('wonder-berry'),
    lunaCrystal: document.getElementById('luna-crystal')
  };

  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  function render() {
    els.cash.textContent = won(state.cash);
    els.totalSpent.textContent = won(state.totalSpent);
    els.wonderBerry.textContent = state.wonderBerry;
    els.lunaCrystal.textContent = state.lunaCrystal;
  }

  function showMessage(text) { els.message.textContent = text || ''; }

  function commit() {
    GameState.save(window.localStorage, state);
    render();
  }

  // 충전 금액 선택지: 10,000원 ~ 1,000,000원
  [10000, 30000, 50000, 100000, 300000, 500000, 1000000].forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v;
    opt.textContent = won(v);
    els.amount.appendChild(opt);
  });

  els.chargeBtn.addEventListener('click', function () {
    var result = GameState.charge(state, Number(els.amount.value));
    showMessage(result.ok ? won(Number(els.amount.value)) + ' 충전 완료 (가상 결제)' : result.error);
    if (result.ok) commit();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-product]'), function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-product');
      var result = GameState.purchase(state, id);
      showMessage(result.ok ? GameState.PRODUCTS[id].label + ' 구매 완료' : result.error);
      if (result.ok) commit();
    });
  });

  render();
})();
