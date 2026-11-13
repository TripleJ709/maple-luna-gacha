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
    lunaCrystal: document.getElementById('luna-crystal'),
    inventory: document.getElementById('inventory-list'),
    dialog: document.getElementById('result-dialog'),
    resultList: document.getElementById('result-list'),
    resultTitle: document.getElementById('result-title'),
    sweetA: document.getElementById('sweet-a'),
    sweetB: document.getElementById('sweet-b'),
    sweetBtn: document.getElementById('sweet-btn'),
    dreamSweet: document.getElementById('dream-sweet'),
    dreamBlack: document.getElementById('dream-black'),
    dreamBtn: document.getElementById('dream-btn'),
    resultClose: document.getElementById('result-close')
  };

  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  // 인벤토리 표시 묶음 (순서대로 표시)
  var K = GachaData.KIND;
  var INVENTORY_GROUPS = [
    { title: '원더 블랙 (희귀)', kinds: [K.WONDER_BLACK] },
    { title: '원더베리 획득 아이템', kinds: [K.WONDER_ITEM] },
    { title: '루나 스윗 펫', kinds: [K.SWEET_PET] },
    { title: '루나 드림 펫', kinds: [K.DREAM_PET] },
    { title: '루나 쁘띠 펫', kinds: [K.PETIT] },
    { title: '펫장비', kinds: [K.KEY] }
  ];

  // 아이템 한 개를 이름 카드로 만든다. 이미지가 지정되면 이미지를, 없으면 텍스트를 쓴다.
  function itemLabel(item, count) {
    var span = document.createElement('span');
    span.className = 'item grade-' + item.grade;
    if (item.image) {
      var img = document.createElement('img');
      img.src = item.image;
      img.alt = item.name;
      span.appendChild(img);
    }
    span.appendChild(document.createTextNode(item.name + (count ? ' x' + count : '')));
    return span;
  }

  function renderInventory() {
    els.inventory.textContent = '';
    var any = false;
    INVENTORY_GROUPS.forEach(function (group) {
      var items = Object.keys(state.inventory)
        .map(function (id) { return GachaData.ITEM_INDEX[id]; })
        .filter(function (it) { return it && group.kinds.indexOf(it.kind) !== -1; });
      if (!items.length) return;
      any = true;
      var box = document.createElement('div');
      var h = document.createElement('h3');
      h.textContent = group.title;
      box.appendChild(h);
      items.forEach(function (it) { box.appendChild(itemLabel(it, state.inventory[it.id])); });
      els.inventory.appendChild(box);
    });
    if (!any) els.inventory.textContent = '아직 획득한 아이템이 없습니다.';
  }

  // 합성 재료 선택지: 보유 중인 해당 종류 아이템만 표시. 선택값은 가능하면 유지한다.
  function fillOptions(sel, table, kind, emptyText) {
    var prev = sel.value;
    sel.textContent = '';
    table.forEach(function (it) {
      if (it.kind !== kind || !state.inventory[it.id]) return;
      var opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = it.name + ' (보유 ' + state.inventory[it.id] + ')';
      sel.appendChild(opt);
    });
    if (!sel.options.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = emptyText;
      sel.appendChild(empty);
    }
    if (prev) sel.value = prev;
  }

  function renderSynthesisOptions() {
    var black = GachaData.KIND.WONDER_BLACK;
    fillOptions(els.sweetA, GachaData.WONDER_BERRY_TABLE, black, '원더 블랙 없음');
    fillOptions(els.sweetB, GachaData.WONDER_BERRY_TABLE, black, '원더 블랙 없음');
    fillOptions(els.dreamBlack, GachaData.WONDER_BERRY_TABLE, black, '원더 블랙 없음');
    fillOptions(els.dreamSweet, GachaData.SWEET_TABLE, GachaData.KIND.SWEET_PET, '스윗 펫 없음');
  }

  function showResults(title, items) {
    els.resultTitle.textContent = title;
    els.resultList.textContent = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.appendChild(itemLabel(it));
      els.resultList.appendChild(li);
    });
    els.dialog.showModal();
  }

  function render() {
    renderInventory();
    renderSynthesisOptions();
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

  els.dreamBtn.addEventListener('click', function () {
    var result = GameState.synthesizeDream(state, els.dreamSweet.value, els.dreamBlack.value);
    if (!result.ok) { showMessage(result.error); return; }
    showMessage('');
    commit();
    showResults('드림 합성 결과', [result.result]);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-draw]'), function (btn) {
    btn.addEventListener('click', function () {
      var result = GameState.drawWonderBerry(state, Number(btn.getAttribute('data-draw')));
      if (!result.ok) { showMessage(result.error); return; }
      showMessage('');
      commit();
      showResults('뽑기 결과', result.results);
    });
  });

  els.sweetBtn.addEventListener('click', function () {
    var result = GameState.synthesizeSweet(state, els.sweetA.value, els.sweetB.value);
    if (!result.ok) { showMessage(result.error); return; }
    showMessage('');
    commit();
    showResults('스윗 합성 결과', [result.result]);
  });
  els.resultClose.addEventListener('click', function () { els.dialog.close(); });

  render();
})();
