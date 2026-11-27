/* 그라데이션 화면 부품 (게임 로직과 분리).
   나중에 GLB 3D 모델로 바꿀 때는 이 파일의 bin()/cube() 구현만 교체하면 된다.
   (예: <model-viewer src="models/bin_lv{level}.glb"> 로 대체. 호출하는 쪽은 인자만 넘긴다) */
(function (root) {
  'use strict';

  const LEVEL_CLASS = ['k', 'd', 'l', 'w']; // 검정, 진한 회색, 밝은 회색, 흰색

  /**
   * 큐브 통 한 개.
   * opts: { level:0~3, value:숫자|null(미공개), open:boolean(뚜껑 열림), used:boolean(사용됨, 자리만 유지),
   *         selected, win, lose, big, tag:'button'|'div', attrs:'data-act=...' }
   */
  function bin(opts) {
    const o = Object.assign({ level: 0, value: null, open: false, used: false, selected: false, win: false, lose: false, big: false, tag: 'div', attrs: '' }, opts);
    const cls = ['gbin', 'lv' + LEVEL_CLASS[o.level], o.open ? 'open' : '', o.used ? 'used' : '', o.selected ? 'sel' : '', o.win ? 'win' : '', o.lose ? 'lose' : '', o.big ? 'big' : ''].filter(Boolean).join(' ');
    const cube = o.value === null ? '' : `<span class="gcube">${o.value}</span>`;
    return `<${o.tag} class="${cls}" ${o.attrs}><span class="glid"></span><span class="gbody">${cube}</span></${o.tag}>`;
  }

  const emptySlot = (label) => `<div class="gslot"><div class="gbin big ghost"></div><small>${label}</small></div>`;

  root.GradView = { bin, emptySlot };
  if (typeof module !== 'undefined') module.exports = root.GradView;
})(typeof window !== 'undefined' ? window : globalThis);
