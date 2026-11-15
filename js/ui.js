/* 화면 연결. 상태는 GameState에서 관리하고, 여기서는 표시와 이벤트만 다룬다. */
(function () {
  var state = GameState.load(window.localStorage);

  var els = {
    cash: document.getElementById('cash'),
    maplePoint: document.getElementById('maple-point'),
    moneySummary: document.getElementById('money-summary'),
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
    openLuna: document.getElementById('open-luna'),
    synthPreview: document.getElementById('synth-preview'),
    synthDialog: document.getElementById('synth-dialog'),
    synthTitle: document.getElementById('synth-title'),
    synthInfo: document.getElementById('synth-info'),
    synthSlots: document.getElementById('synth-slots'),
    synthPicker: document.getElementById('synth-picker'),
    synthError: document.getElementById('synth-error'),
    synthRun: document.getElementById('synth-run'),
    synthCancel: document.getElementById('synth-cancel'),
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
  function point(n) { return n.toLocaleString('ko-KR') + 'P'; }

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

  // 페이백: 선택한 펫을 1개씩(또는 보유한 전부) 메이플포인트로 돌려받는다.
  function doPayback(items, everything) {
    var total = 0;
    var count = 0;
    items.forEach(function (it) {
      var n = everything ? state.inventory[it.id] || 0 : 1;
      if (!n) return;
      var r = GameState.payback(state, it.id, n);
      if (r.ok) { total += r.point; count += n; }
    });
    if (!count) { showMessage('페이백할 아이템이 없습니다.'); return; }
    showMessage('펫 ' + count + '개를 페이백해 ' + point(total) + '를 받았습니다.');
    commit();
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
      var refundable = items.filter(function (it) { return it.payback; });
      if (refundable.length) {
        var all = document.createElement('button');
        all.type = 'button';
        all.className = 'payback-all';
        all.textContent = '상급 펫 모두 페이백';
        all.addEventListener('click', function () { doPayback(refundable, true); });
        h.appendChild(all);
      }
      items.forEach(function (it) {
        var label = itemLabel(it, state.inventory[it.id]);
        if (!it.payback) { box.appendChild(label); return; }
        // 원더 펫은 인벤토리에서 바로 페이백(메이플포인트로 돌려받기)할 수 있다.
        var entry = document.createElement('span');
        entry.className = 'inv-entry';
        entry.appendChild(label);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'payback-btn';
        btn.textContent = '페이백 +' + point(it.payback);
        btn.addEventListener('click', function () { doPayback([it], false); });
        entry.appendChild(btn);
        box.appendChild(entry);
      });
      els.inventory.appendChild(box);
    });
    if (!any) els.inventory.textContent = '아직 획득한 아이템이 없습니다.';
  }

  // ---- 합성 창: 루나 크리스탈 사용하기 → 재료 칸에 펫을 넣고 합성 ----
  // 버튼은 하나이고, 넣은 재료의 조합으로 스윗/드림 합성이 정해진다.
  var synthSelected = [null, null]; // 칸별 선택된 아이템 id (비어 있으면 null)
  var SYNTH_LABEL = { sweet: '스윗 합성', dream: '드림 합성' };
  var SYNTH_NOTE = { dream: '재료로 쓴 스윗 펫과 같은 종류의 드림 펫은 나오지 않습니다.' };

  function openSynth() {
    if (state.pending) { showMessage('이전 결과를 먼저 확인해 주세요.'); return; }
    if (state.lunaCrystal < 1) { showMessage('루나 크리스탈이 부족합니다. 캐시샵에서 구매해 주세요.'); return; }
    synthSelected = [null, null];
    renderSynth();
    els.synthDialog.showModal();
  }

  // 합성 종류별 공식 확률(등급 묶음 합계)을 한 줄로 보여준다.
  function previewBlock(mode) {
    var rows = GameStats.summarize(GameState.createState(), mode).rows;
    var box = document.createElement('div');
    box.className = 'preview-block';
    var head = document.createElement('strong');
    head.textContent = SYNTH_LABEL[mode];
    box.appendChild(head);
    var line = document.createElement('span');
    line.textContent = rows.map(function (r) { return r.label + ' ' + pct(r.official); }).join(' · ');
    box.appendChild(line);
    if (SYNTH_NOTE[mode]) {
      var note = document.createElement('small');
      note.textContent = SYNTH_NOTE[mode];
      box.appendChild(note);
    }
    return box;
  }

  // 먼저 넣은 재료에 따라 가능한 합성과 루나 쁘띠 확률이 달라진다.
  function renderPreview() {
    els.synthPreview.textContent = '';
    var chosen = synthSelected.filter(Boolean);
    var p = document.createElement('p');
    p.className = 'desc';
    if (!chosen.length) {
      p.textContent = '원더 블랙 또는 루나 스윗 펫을 넣어 주세요.';
      els.synthPreview.appendChild(p);
      return;
    }
    if (chosen.length === 2) {
      els.synthPreview.appendChild(previewBlock(GameState.synthModeOf(chosen[0], chosen[1])));
      return;
    }
    var first = GachaData.ITEM_INDEX[chosen[0]];
    if (first.kind === GachaData.KIND.SWEET_PET) {
      p.textContent = '원더 블랙을 하나 더 넣으면 드림 합성이 됩니다.';
      els.synthPreview.appendChild(p);
      els.synthPreview.appendChild(previewBlock('dream'));
    } else {
      p.textContent = '두 번째 재료에 따라 합성이 달라집니다.';
      els.synthPreview.appendChild(p);
      els.synthPreview.appendChild(previewBlock('sweet'));
      els.synthPreview.appendChild(previewBlock('dream'));
    }
  }

  function renderSynth() {
    els.synthTitle.textContent = '루나 크리스탈';
    els.synthInfo.textContent = '루나 크리스탈 1개가 사용됩니다. (보유 ' + state.lunaCrystal + '개)';
    els.synthError.textContent = '';

    // 재료 칸: 넣은 펫을 누르면 빼낸다.
    els.synthSlots.textContent = '';
    synthSelected.forEach(function (id, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot' + (id ? ' filled' : '');
      if (id) {
        btn.appendChild(itemLabel(GachaData.ITEM_INDEX[id]));
        btn.title = '눌러서 빼기';
        btn.addEventListener('click', function () { synthSelected[i] = null; renderSynth(); });
      } else {
        btn.textContent = '재료 ' + (i + 1);
        btn.disabled = true;
      }
      els.synthSlots.appendChild(btn);
    });

    renderPreview();

    // 재료 목록: 보유한 원더 블랙과 루나 스윗 펫만 보여주고, 지금 조합이 안 되는 것은 회색으로 막는다.
    els.synthPicker.textContent = '';
    var any = false;
    var usable = [GachaData.KIND.WONDER_BLACK, GachaData.KIND.SWEET_PET];
    INVENTORY_GROUPS.forEach(function (group) {
      Object.keys(state.inventory)
        .map(function (id) { return GachaData.ITEM_INDEX[id]; })
        .filter(function (it) { return it && group.kinds.indexOf(it.kind) !== -1 && usable.indexOf(it.kind) !== -1; })
        .forEach(function (it) {
          any = true;
          var used = synthSelected.filter(function (x) { return x === it.id; }).length;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pick';
          btn.disabled = !GameState.canSelect(state, synthSelected, it.id);
          btn.appendChild(itemLabel(it, state.inventory[it.id] - used));
          btn.addEventListener('click', function () {
            var idx = GameState.firstOpenSlot(synthSelected);
            if (idx === -1) return;
            synthSelected[idx] = it.id;
            renderSynth();
          });
          els.synthPicker.appendChild(btn);
        });
    });
    if (!any) els.synthPicker.textContent = '합성에 쓸 수 있는 펫(원더 블랙, 루나 스윗 펫)이 없습니다.';

    els.synthRun.disabled = synthSelected.some(function (x) { return !x; });
  }

  els.openLuna.addEventListener('click', openSynth);
  els.synthCancel.addEventListener('click', function () { els.synthDialog.close(); });
  els.synthRun.addEventListener('click', function () {
    var result = GameState.runSynthesis(state, synthSelected);
    if (!result.ok) { els.synthError.textContent = result.error; return; }
    els.synthDialog.close();
    showMessage('');
    commit();
    showResults(SYNTH_LABEL[result.mode] + ' 결과', [result.result]);
  });

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

  function showResults(title, items) {
    var rareItems = items.filter(function (it) { return it.grade === GachaData.GRADE.RARE; });
    var isRare = rareItems.length > 0;
    clearSparkles();
    els.dialog.classList.toggle('rare-result', isRare);
    els.resultTitle.textContent = title;
    els.resultList.textContent = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var rare = it.grade === GachaData.GRADE.RARE;
      if (rare) {
        li.className = 'rare-card';
      }
      li.appendChild(itemLabel(it, 0, true));
      els.resultList.appendChild(li);
    });
    if (isRare) addSparkles();
    els.dialog.showModal();
  }

  function pct(n) { return (Math.round(n * 100) / 100).toFixed(2) + '%'; }

  function renderMoneySummary() {
    els.moneySummary.textContent = '';
    [
      ['누적 사용 금액', won(state.totalSpent)],
      ['누적 페이백', point(state.totalPayback)],
      ['실질 사용 금액 (사용 금액 - 페이백)', won(state.totalSpent - state.totalPayback)]
    ].forEach(function (row) {
      var p = document.createElement('p');
      p.className = 'stat';
      p.appendChild(document.createTextNode(row[0] + ' '));
      var strong = document.createElement('strong');
      strong.textContent = row[1];
      p.appendChild(strong);
      els.moneySummary.appendChild(p);
    });
  }

  function renderStats() {
    renderMoneySummary();
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
    els.cash.textContent = won(state.cash);
    els.maplePoint.textContent = point(state.maplePoint);
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

  Array.prototype.forEach.call(document.querySelectorAll('[data-draw]'), function (btn) {
    btn.addEventListener('click', function () {
      var result = GameState.drawWonderBerry(state, Number(btn.getAttribute('data-draw')));
      if (!result.ok) { showMessage(result.error); return; }
      showMessage('');
      commit();
      showResults('뽑기 결과', result.results);
    });
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
