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
    resultClose: document.getElementById('result-close'),
    autoStrategy: document.getElementById('auto-strategy'),
    autoTarget: document.getElementById('auto-target'),
    autoLimit: document.getElementById('auto-limit'),
    autoBtn: document.getElementById('auto-btn'),
    autoResult: document.getElementById('auto-result'),
    resetBtn: document.getElementById('reset-btn'),
    statsList: document.getElementById('stats-list'),
    historyList: document.getElementById('history-list')
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

  // 이미지/영상 요소를 만든다. mp4는 소리 없이 반복 재생하고, 그 외(png, gif, webp)는 img로 표시한다.
  function mediaElement(src, animated) {
    var el;
    if (/\.mp4$/i.test(src)) {
      el = document.createElement('video');
      el.src = src;
      el.autoplay = true;
      el.loop = true;
      el.muted = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el = document.createElement('img');
      el.src = src;
      el.alt = '';
    }
    if (animated) el.className = 'sprite';
    return el;
  }

  // 아이템 한 개를 이름 카드로 만든다.
  // preferAnim=true(결과 팝업)이면 움직이는 펫(anim)을 우선, 아니면 정지 이미지(image)를 우선한다.
  // 어느 쪽도 없으면 텍스트만 표시한다.
  function itemLabel(item, count, preferAnim) {
    var span = document.createElement('span');
    span.className = 'item grade-' + item.grade;
    var src = preferAnim ? (item.anim || item.image) : (item.image || item.anim);
    if (src) {
      span.classList.add('has-img');
      span.appendChild(mediaElement(src, src === item.anim));
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

  // 희귀(등급 rare: 원더 블랙, 루나 쁘띠)가 나오면 팝업을 특별하게 연출한다.
  var SPARKLE_COUNT = 16;

  function clearSparkles() {
    Array.prototype.forEach.call(els.dialog.querySelectorAll('.spark'), function (n) { n.remove(); });
  }

  function addSparkles() {
    for (var i = 0; i < SPARKLE_COUNT; i++) {
      var sp = document.createElement('span');
      sp.className = 'spark';
      sp.textContent = i % 3 === 0 ? '✦' : '✧';
      sp.style.left = (4 + Math.random() * 92) + '%';
      sp.style.top = (4 + Math.random() * 92) + '%';
      sp.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's';
      sp.style.fontSize = (12 + Math.random() * 16).toFixed(0) + 'px';
      els.dialog.appendChild(sp);
    }
  }

  function rareTitle(rareItems, fallback) {
    var petit = rareItems.filter(function (it) { return it.kind === GachaData.KIND.PETIT; })[0];
    if (petit) return '🌙 루나 쁘띠 획득! 🌙';
    return fallback;
  }

  function showResults(title, items) {
    var rareItems = items.filter(function (it) { return it.grade === GachaData.GRADE.RARE; });
    var isRare = rareItems.length > 0;
    clearSparkles();
    els.dialog.classList.toggle('rare-result', isRare);
    els.resultTitle.textContent = isRare ? rareTitle(rareItems, title) : title;
    els.resultList.textContent = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var rare = it.grade === GachaData.GRADE.RARE;
      if (rare) {
        li.className = 'rare-card';
        // 여러 개를 뽑았을 때는 일반 카드가 모두 나온 뒤 마지막에 등장시킨다.
        li.style.animationDelay = (items.length > 1 ? 0.9 : 0.3) + 's';
      }
      li.appendChild(itemLabel(it, 0, true));
      els.resultList.appendChild(li);
    });
    if (isRare) addSparkles();
    els.dialog.showModal();
  }

  function pct(n) { return (Math.round(n * 100) / 100).toFixed(2) + '%'; }

  function renderStats() {
    els.statsList.textContent = '';
    Object.keys(GameStats.SOURCES).forEach(function (src) {
      var sum = GameStats.summarize(state, src);
      var box = document.createElement('div');
      var h = document.createElement('h3');
      h.textContent = GameStats.SOURCES[src].label + ' - 총 ' + sum.total + '회';
      box.appendChild(h);
      var table = document.createElement('table');
      table.className = 'stats-table';
      var head = table.insertRow();
      ['구분', '횟수', '실제', '공식'].forEach(function (t) {
        var th = document.createElement('th');
        th.textContent = t;
        head.appendChild(th);
      });
      sum.rows.forEach(function (r) {
        var tr = table.insertRow();
        [r.label, r.count + '회', sum.total ? pct(r.actual) : '-', pct(r.official)].forEach(function (t) {
          tr.insertCell().textContent = t;
        });
      });
      box.appendChild(table);
      els.statsList.appendChild(box);
    });

    els.historyList.textContent = '';
    if (!state.history.length) {
      var empty = document.createElement('li');
      empty.textContent = '아직 기록이 없습니다.';
      els.historyList.appendChild(empty);
    }
    state.history.forEach(function (h) {
      var li = document.createElement('li');
      var meta = document.createElement('span');
      meta.className = 'history-meta';
      meta.textContent = new Date(h.time).toLocaleTimeString('ko-KR') + ' · ' + GameStats.SOURCES[h.source].label;
      li.appendChild(meta);
      h.ids.forEach(function (id) { li.appendChild(itemLabel(GachaData.ITEM_INDEX[id])); });
      els.historyList.appendChild(li);
    });
  }

  function render() {
    renderStats();
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

  // 팝업이 닫히면(확인 버튼, Esc 모두) 대기 중인 결과를 인벤토리에 반영한다.
  els.dialog.addEventListener('close', function () {
    if (GameState.confirmPending(state).ok) commit();
  });

  // 확인하지 않고 새로고침한 경우: 대기 중인 결과를 다시 보여준다.
  if (state.pending) {
    showResults(state.pending.title, state.pending.ids.map(function (id) { return GachaData.ITEM_INDEX[id]; }));
  }

  // 자동 반복 합성: 목표와 사용 한도 선택지
  [['any', '아무 루나 쁘띠']].concat(GachaData.SWEET_TABLE.filter(function (it) {
    return it.kind === GachaData.KIND.PETIT;
  }).map(function (it) { return [it.id, it.name]; })).forEach(function (t) {
    var opt = document.createElement('option');
    opt.value = t[0];
    opt.textContent = t[1];
    els.autoTarget.appendChild(opt);
  });
  [1000000, 3000000, 5000000, 10000000, 30000000].forEach(function (v) {
    var opt = document.createElement('option');
    opt.value = v;
    opt.textContent = won(v);
    els.autoLimit.appendChild(opt);
  });

  els.autoBtn.addEventListener('click', function () {
    if (state.pending) { showMessage('이전 결과를 먼저 확인해 주세요.'); return; }
    var sum = AutoSynth.run(state, {
      strategy: els.autoStrategy.value,
      target: els.autoTarget.value,
      spendLimit: Number(els.autoLimit.value)
    });
    commit();
    var found = sum.found ? sum.found.name : '';
    var lines = [
      sum.success ? '🎉 목표 달성! 획득: ' + found : '⛔ 사용 한도(' + won(Number(els.autoLimit.value)) + ')에 도달해 중단했습니다.',
      '이번 실행 사용 금액: ' + won(sum.spent),
      '구매 ' + sum.purchases + '회 · 원더베리 뽑기 ' + sum.draws + '회 · 스윗 합성 ' + sum.sweets + '회 · 드림 합성 ' + sum.dreams + '회'
    ];
    els.autoResult.textContent = '';
    lines.forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      els.autoResult.appendChild(p);
    });
  });

  // 초기화: 캐시, 인벤토리, 통계, 기록을 모두 처음 상태로 되돌린다.
  els.resetBtn.addEventListener('click', function () {
    if (!window.confirm('캐시, 인벤토리, 통계, 기록을 모두 처음 상태로 되돌립니다. 계속할까요?')) return;
    GameState.reset(state);
    els.autoResult.textContent = '';
    commit();
    showMessage('초기화했습니다.');
  });

  // 탭 전환: 선택한 탭의 화면만 보이게 한다.
  var tabButtons = document.querySelectorAll('.tab');
  function selectTab(name) {
    Array.prototype.forEach.call(tabButtons, function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab-panel'), function (p) {
      p.hidden = p.id !== 'tab-' + name;
    });
    showMessage('');
  }
  Array.prototype.forEach.call(tabButtons, function (b) {
    b.addEventListener('click', function () { selectTab(b.getAttribute('data-tab')); });
  });

  render();
})();
