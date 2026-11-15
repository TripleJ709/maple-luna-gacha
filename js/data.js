/*
 * 공식 확률 데이터 (확률 단위: %)
 * 출처 (메이플스토리 공식 홈페이지, 확률형 아이템):
 *  - 위습의 원더베리: https://maplestory.nexon.com/Guide/CashShop/Probability/WispsWonderBerry (2026-09-24 오전 10시 이후)
 *  - 루나 크리스탈 스윗: https://maplestory.nexon.com/Guide/CashShop/Probability/LunaCrystalSweet
 *  - 루나 크리스탈 드림: https://maplestory.nexon.com/Guide/CashShop/Probability/LunaCrystalDream
 *
 * image: IMAGES에 이름별 경로를 추가하면 화면에 반영된다. (null이면 텍스트로 표시)
 */
(function (root) {
  var GRADE = { RARE: 'rare', HIGH: 'high', NORMAL: 'normal' };
  var KIND = {
    WONDER_BLACK: 'wonderBlack',
    WONDER_ITEM: 'wonderItem',
    SWEET_PET: 'sweetPet',
    DREAM_PET: 'dreamPet',
    PETIT: 'petit',
    KEY: 'key'
  };

  var PRICES = {
    wonderBerry1: 5400,
    wonderBerry11: 54000,
    lunaCrystal1: 3900
  };

  // 이름 -> 이미지 경로. 같은 이름의 스윗/드림 펫은 같은 이미지를 쓴다.
  // 이미지가 아직 없는 아이템은 여기에 추가하기 전까지 텍스트로 표시된다.
  var IMAGES = {
    '이그넬라': 'assets/items/ignella.png',
    '아쿠엘': 'assets/items/aquel.png',
    '윈디르': 'assets/items/windir.png',
    '카투': 'assets/items/katu.png',
    '카티엘': 'assets/items/katiel.png',
    '파라키': 'assets/items/paraki.png',
    '쿠키베어': 'assets/items/cookie-bear.png',
    '뚠냥': 'assets/items/ttunnyang.png',
    '오가닉 원더 쿠키': 'assets/items/organic-cookie.png',
    '고농축 프리미엄 생명의 물': 'assets/items/life-water.png',
    '백야': 'assets/items/baegya.png',
    '설아': 'assets/items/seola.png',
    '쁘띠 블러드': 'assets/items/petit-blood.png'
  };

  // 이름 -> 움직이는 펫 이미지(투명 배경 animated webp, gif). 결과 팝업에서 우선 보여주고, 정지 이미지가 없으면 인벤토리에서도 쓴다.
  var ANIMS = {
    '이그넬라': 'assets/anim/ignella.webp',
    '아쿠엘': 'assets/anim/aquel.webp',
    '윈디르': 'assets/anim/windir.webp',
    '카투': 'assets/anim/katu.webp',
    '카티엘': 'assets/anim/katiel.webp',
    '파라키': 'assets/anim/paraki.webp',
    '쿠키베어': 'assets/anim/cookie-bear.webp',
    '뚠냥': 'assets/anim/ttunnyang.webp',
    '쿨쿨 곰돌이': 'assets/anim/kulkul-bear.webp',
    '쿨쿨 다람쥐': 'assets/anim/kulkul-squirrel.webp',
    '쿨쿨 너구리': 'assets/anim/kulkul-raccoon.webp',
    '프링': 'assets/anim/pring.webp',
    '레옹': 'assets/anim/leon.webp',
    '주니': 'assets/anim/juni.webp',
    '토토 사원': 'assets/anim/toto.webp',
    '곰곰 사원': 'assets/anim/gomgom.webp',
    '펭펭 사원': 'assets/anim/pengpeng.webp'
  };

  function item(id, name, kind, grade, prob) {
    return { id: id, name: name, kind: kind, grade: grade, prob: prob, image: IMAGES[name] || null, anim: ANIMS[name] || null };
  }

  var WONDER_BERRY_TABLE = [
    item('wb:이그넬라', '이그넬라', KIND.WONDER_BLACK, GRADE.RARE, 3.32),
    item('wb:아쿠엘', '아쿠엘', KIND.WONDER_BLACK, GRADE.RARE, 3.32),
    item('wb:윈디르', '윈디르', KIND.WONDER_BLACK, GRADE.RARE, 3.32),
    item('wb:카투', '카투', KIND.WONDER_ITEM, GRADE.HIGH, 12),
    item('wb:카티엘', '카티엘', KIND.WONDER_ITEM, GRADE.HIGH, 12),
    item('wb:파라키', '파라키', KIND.WONDER_ITEM, GRADE.HIGH, 12),
    item('wb:쿠키베어', '쿠키베어', KIND.WONDER_ITEM, GRADE.HIGH, 12),
    item('wb:뚠냥', '뚠냥', KIND.WONDER_ITEM, GRADE.HIGH, 12),
    item('wb:오가닉 원더 쿠키', '오가닉 원더 쿠키', KIND.WONDER_ITEM, GRADE.NORMAL, 15.02),
    item('wb:고농축 프리미엄 생명의 물', '고농축 프리미엄 생명의 물', KIND.WONDER_ITEM, GRADE.NORMAL, 15.02)
  ];

  var LUNA_PET_NAMES = [
    '쿨쿨 곰돌이', '쿨쿨 다람쥐', '쿨쿨 너구리',
    '프링', '레옹', '주니',
    '토토 사원', '곰곰 사원', '펭펭 사원'
  ];
  var PETIT_NAMES = ['백야', '설아', '쁘띠 블러드'];
  var KEY_NAME = '루나 크리스탈 키';

  function buildLunaTable(prefix, petKind, petProb, petitProb, keyProb) {
    var table = LUNA_PET_NAMES.map(function (n) {
      return item(prefix + ':' + n, n, petKind, GRADE.HIGH, petProb);
    });
    PETIT_NAMES.forEach(function (n) {
      table.push(item('petit:' + n, n, KIND.PETIT, GRADE.RARE, petitProb));
    });
    table.push(item('key', KEY_NAME, KIND.KEY, GRADE.NORMAL, keyProb));
    return table;
  }

  var SWEET_TABLE = buildLunaTable('sweet', KIND.SWEET_PET, 9.6, 3.88, 1.96);
  var DREAM_TABLE = buildLunaTable('dream', KIND.DREAM_PET, 8.4, 6.8, 4);

  // id로 아이템 정보를 찾기 위한 색인 (인벤토리 표시용)
  var ITEM_INDEX = {};
  WONDER_BERRY_TABLE.concat(SWEET_TABLE, DREAM_TABLE).forEach(function (e) { ITEM_INDEX[e.id] = e; });

  /*
   * 페이백: 위습의 원더베리로 얻은 원더 펫(교환하지 않은 경우)은 원더베리 금액의 10%를 메이플포인트로 돌려받는다.
   * 출처: https://maplestory.nexon.com/Guide/N23GameInformation/Articles/437
   * 대상은 상급 펫 5종(카투, 카티엘, 파라키, 쿠키베어, 뚠냥). 금액은 원더베리 1개 가격(5,400원)의 10%인 540P.
   */
  var PAYBACK_RATE = 0.1;
  var PAYBACK_POINT = Math.round(PRICES.wonderBerry1 * PAYBACK_RATE);
  var PAYBACK_NAMES = ['카투', '카티엘', '파라키', '쿠키베어', '뚠냥'];
  WONDER_BERRY_TABLE.forEach(function (e) {
    e.payback = PAYBACK_NAMES.indexOf(e.name) !== -1 ? PAYBACK_POINT : 0;
  });

  var data = {
    PAYBACK_POINT: PAYBACK_POINT,
    ITEM_INDEX: ITEM_INDEX,
    GRADE: GRADE,
    KIND: KIND,
    PRICES: PRICES,
    WONDER_BERRY_TABLE: WONDER_BERRY_TABLE,
    SWEET_TABLE: SWEET_TABLE,
    DREAM_TABLE: DREAM_TABLE,
    KEY_ID: 'key',
    WONDER_BERRY_ICON: 'assets/items/wonderberry.webp',
    LUNA_CRYSTAL_ICON: 'assets/items/luna-crystal.webp'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.GachaData = data;
})(typeof window !== 'undefined' ? window : globalThis);
