# 루나쁘띠 뽑기 시뮬레이터 - 작업 목록

메이플스토리 위습의 원더베리 / 루나 크리스탈 스윗 / 드림 흐름을 HTML, CSS, JavaScript만으로 재현하는 정적 웹 시뮬레이터. GitHub Pages로 배포한다. 실제 결제는 없다.

## 확정 사항

- 기술: HTML/CSS/JS only. 테스트는 Node 내장 `node --test` (개발용).
- 확률 출처(공식, 2026-09-24 오전 10시 이후 표):
  - https://maplestory.nexon.com/Guide/CashShop/Probability/WispsWonderBerry
  - https://maplestory.nexon.com/Guide/CashShop/Probability/LunaCrystalSweet
  - https://maplestory.nexon.com/Guide/CashShop/Probability/LunaCrystalDream
- 충전 10,000~1,000,000원(단순 가산). 누적 사용 금액 = 구매에 쓴 금액 합(충전 제외).
- 가격: 원더베리 1개 5,400원 / 11개 54,000원, 루나 크리스탈 1개 3,900원.
- 뽑기 1회 = 원더베리 1개, 5회 = 5개.
- 스윗: 원더 블랙(희귀) 2개(종류 무관) + 크리스탈 1개.
- 드림: 스윗 펫 1 + 원더 블랙 1 + 크리스탈 1. 스윗 펫이 베이스(같은 종류 제외, 나머지 8종 각 9.45%). 드림 펫은 재료 불가.
- 이미지 없이 텍스트/이모지/CSS. 이름과 이미지 경로는 `js/data.js` 한 곳에 모은다.
- 커밋당 200~400줄 이내. 커밋/푸시는 사용자 확인 후.

## 작업

- [x] **Task 1: 프로젝트 골격과 확률 데이터** (`data.js`, `gacha.js`, 빈 `index.html`, 확률 테스트)
  - 테스트 실행: `node --test "tests/*.test.js"` (7개 통과)
- [x] **Task 2: 상태 관리와 캐시 충전** (`state.js`, localStorage, 충전 UI)
- [x] **Task 3: 재화 구매** (원더베리 1/11개, 루나 크리스탈)
- [x] **Task 4: 원더베리 뽑기와 인벤토리** (1회/5회, 결과 팝업)
- [x] **Task 5: 루나 크리스탈 스윗 합성**
- [x] **Task 6: 루나 크리스탈 드림 합성**
- [x] **Task 7: 게임 화면과 비슷한 디자인(텍스트 기반)**
  - 수동 확인 체크리스트: `ui-checklist.md` (화면 확인은 사용자 몫)
- [x] **Task 8: GitHub Pages 배포와 문서화** (README, 비공식 팬 프로젝트 고지)
- [x] **추가: 아이템 이미지 적용** (13종 적용, 스윗/드림 펫 18종과 루나 크리스탈 키는 이미지 대기)
