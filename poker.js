/* 기억포커 로직 (DOM 의존 없음) */
(function (root) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const label = (r) => RANK_LABEL[r] || String(r);

  const HAND_NAMES = ['하이카드', '원페어', '투페어', '트리플', '풀하우스', '포카드'];

  function newDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ rank: r, suit: SUITS[s] });
    return d;
  }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 16장 격자(4x4) + 겹치지 않는 공유 카드 3장
  function deal() {
    const deck = shuffle(newDeck());
    return { grid: deck.slice(0, 16), shared: deck.slice(16, 19) };
  }

  /**
   * 5장 족보 평가. 문양 무관, A 최고.
   * 반환 key: [족보등급, ...(개수 많은 순, 같으면 숫자 높은 순) 숫자들]  (사전식으로 클수록 강함)
   */
  function evalHand(cards) {
    const cnt = {};
    cards.forEach((c) => (cnt[c.rank] = (cnt[c.rank] || 0) + 1));
    const groups = Object.keys(cnt)
      .map((r) => ({ rank: +r, n: cnt[r] }))
      .sort((a, b) => b.n - a.n || b.rank - a.rank);
    const shape = groups.map((g) => g.n).join('');
    let cat = 0;
    if (shape === '41') cat = 5;
    else if (shape === '32') cat = 4;
    else if (shape === '311') cat = 3;
    else if (shape === '221') cat = 2;
    else if (shape === '2111') cat = 1;
    return { cat, name: HAND_NAMES[cat], key: [cat].concat(groups.map((g) => g.rank)) };
  }

  function cmpKey(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] === undefined ? -Infinity : a[i];
      const y = b[i] === undefined ? -Infinity : b[i];
      if (x !== y) return x - y;
    }
    return 0;
  }

  // 선택한 격자 인덱스 2개 + 공유 3장
  function handFor(dealt, picks) {
    return evalHand(picks.map((i) => dealt.grid[i]).concat(dealt.shared));
  }

  // AI: 카드별로 기억 확률 p로 기억 → 기억한 카드 중 최선의 2장, 부족하면 무작위 추측
  function aiChoose(dealt, p) {
    const known = [];
    const unknown = [];
    for (let i = 0; i < 16; i++) (Math.random() < p ? known : unknown).push(i);
    let best = null;
    let bestKey = null;
    for (let a = 0; a < known.length; a++) {
      for (let b = a + 1; b < known.length; b++) {
        const h = handFor(dealt, [known[a], known[b]]);
        if (!bestKey || cmpKey(h.key, bestKey) > 0 || (cmpKey(h.key, bestKey) === 0 && Math.random() < 0.3)) {
          best = [known[a], known[b]];
          bestKey = h.key;
        }
      }
    }
    if (best) return best;
    const pool = shuffle(known.concat(unknown));
    // 기억한 카드가 1장이면 그 카드 + 무작위 1장
    if (known.length === 1) return [known[0], pool.find((i) => i !== known[0])];
    return [pool[0], pool[1]];
  }

  root.Poker = { label, HAND_NAMES, deal, evalHand, cmpKey, handFor, aiChoose, shuffle };
  if (typeof module !== 'undefined') module.exports = root.Poker;
})(typeof window !== 'undefined' ? window : globalThis);
