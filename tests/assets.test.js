const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Data = require('../js/data.js');

const root = path.join(__dirname, '..');

test('data.js가 가리키는 이미지/영상 파일이 모두 존재', () => {
  Object.values(Data.ITEM_INDEX).forEach((it) => {
    [it.image, it.anim].filter(Boolean).forEach((p) => {
      assert.ok(fs.existsSync(path.join(root, p)), `${it.name}: ${p}`);
    });
  });
  assert.ok(fs.existsSync(path.join(root, Data.WONDER_BERRY_ICON)));
  assert.ok(fs.existsSync(path.join(root, Data.LUNA_CRYSTAL_ICON)));
});

test('이미지가 전혀 없는 아이템은 루나 크리스탈 키뿐', () => {
  const none = Object.values(Data.ITEM_INDEX).filter((it) => !it.image && !it.anim).map((it) => it.name);
  assert.deepEqual([...new Set(none)], ['루나 크리스탈 키']);
});

test('같은 이름의 스윗/드림 펫은 같은 영상을 공유', () => {
  assert.equal(Data.ITEM_INDEX['sweet:프링'].anim, Data.ITEM_INDEX['dream:프링'].anim);
});
