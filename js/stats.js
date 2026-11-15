/*
 * 통계 계산. 출처(draw/sweet/dream)별로 등급 묶음의 실제 비율과 공식 확률을 비교한다.
 * 드림 합성은 베이스 제외 재분배가 있어도 펫 합계(75.6%)는 변하지 않으므로 묶음 단위 비교가 정확하다.
 */
(function (root) {
  var Data = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.GachaData;
  var K = Data.KIND;

  var SOURCES = {
    draw: { label: '원더베리 뽑기', table: Data.WONDER_BERRY_TABLE, groups: [
      { label: '희귀 (원더 블랙)', test: function (it) { return it.grade === Data.GRADE.RARE; } },
      { label: '상급', test: function (it) { return it.grade === Data.GRADE.HIGH; } },
      { label: '노멀', test: function (it) { return it.grade === Data.GRADE.NORMAL; } }
    ] },
    sweet: { label: '스윗 합성', table: Data.SWEET_TABLE, groups: lunaGroups('루나 스윗 펫', K.SWEET_PET) },
    dream: { label: '드림 합성', table: Data.DREAM_TABLE, groups: lunaGroups('루나 드림 펫', K.DREAM_PET) }
  };

  function lunaGroups(petLabel, petKind) {
    return [
      { label: petLabel, test: function (it) { return it.kind === petKind; } },
      { label: '루나 쁘띠 펫', test: function (it) { return it.kind === K.PETIT; } },
      { label: '루나 크리스탈 키', test: function (it) { return it.kind === K.KEY; } }
    ];
  }

  // 반환: { total, rows: [{ label, count, actual(%), official(%) }] }
  function summarize(state, source) {
    var def = SOURCES[source];
    var counts = state.stats[source];
    var total = Object.keys(counts).reduce(function (sum, id) { return sum + counts[id]; }, 0);
    var rows = def.groups.map(function (g) {
      var official = 0;
      def.table.forEach(function (it) { if (g.test(it)) official += it.prob; });
      var count = 0;
      Object.keys(counts).forEach(function (id) { if (g.test(Data.ITEM_INDEX[id])) count += counts[id]; });
      return { label: g.label, count: count, actual: total ? (count / total) * 100 : 0, official: Math.round(official * 100) / 100 };
    });
    return { total: total, rows: rows };
  }

  var api = { SOURCES: SOURCES, summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
