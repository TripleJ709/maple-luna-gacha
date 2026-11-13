/*
 * 가중치 기반 추첨 로직. rng는 [0, 1) 난수를 돌려주는 함수 (기본값 Math.random).
 */
(function (root) {
  var Data = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.GachaData;

  // 확률(prob)에 비례해 항목 하나를 고른다.
  function pickWeighted(table, rng) {
    rng = rng || Math.random;
    var total = table.reduce(function (sum, e) { return sum + e.prob; }, 0);
    var r = rng() * total;
    for (var i = 0; i < table.length; i++) {
      r -= table[i].prob;
      if (r < 0) return table[i];
    }
    return table[table.length - 1];
  }

  /*
   * 드림 표. 베이스(스윗 펫 이름)와 같은 드림 펫을 제외하고,
   * 나머지 드림 펫 확률을 (100 - 쁘띠 합 - 장비) / (펫 수 - 1) 로 균등 재분배한다.
   * 공식 안내: 베이스가 목록에 있을 때만 적용.
   */
  function getDreamTable(baseName) {
    var table = Data.DREAM_TABLE;
    var pets = table.filter(function (e) { return e.kind === Data.KIND.DREAM_PET; });
    var hasBase = pets.some(function (e) { return e.name === baseName; });
    if (!hasBase) return table.slice();

    var others = table.filter(function (e) { return e.kind !== Data.KIND.DREAM_PET; });
    var fixed = others.reduce(function (sum, e) { return sum + e.prob; }, 0);
    var each = (100 - fixed) / (pets.length - 1);

    var result = [];
    table.forEach(function (e) {
      if (e.kind === Data.KIND.DREAM_PET) {
        if (e.name === baseName) return;
        result.push(Object.assign({}, e, { prob: each }));
      } else {
        result.push(e);
      }
    });
    return result;
  }

  function rollWonderBerry(rng) { return pickWeighted(Data.WONDER_BERRY_TABLE, rng); }
  function rollSweet(rng) { return pickWeighted(Data.SWEET_TABLE, rng); }
  function rollDream(baseName, rng) { return pickWeighted(getDreamTable(baseName), rng); }

  var api = {
    pickWeighted: pickWeighted,
    getDreamTable: getDreamTable,
    rollWonderBerry: rollWonderBerry,
    rollSweet: rollSweet,
    rollDream: rollDream
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gacha = api;
})(typeof window !== 'undefined' ? window : globalThis);
