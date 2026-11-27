/* 그라데이션 규칙 엔진 (DOM·AI 의존 없음). 두 편을 'a', 'b'로 부른다. */
(function (root) {
  'use strict';

  const BINS = 7;
  const MAXSUM = 30;
  const ROUNDS = 7;
  // 통 색상 단계: 0 검정, 1 진한 회색, 2 밝은 회색, 3 흰색 → 1번~7번 통
  const LEVEL = [0, 1, 2, 3, 2, 1, 0];
  const LEVEL_NAME = ['검정', '진한 회색', '밝은 회색', '흰색'];

  const other = (s) => (s === 'a' ? 'b' : 'a');

  // 배치 검증: 문제가 없으면 null, 있으면 사유 문자열
  function validate(arr) {
    if (!Array.isArray(arr) || arr.length !== BINS) return '큐브 7개를 모두 배치해야 해요';
    if (!arr.every((v) => Number.isInteger(v) && v >= 0 && v <= 9)) return '0~9 숫자만 쓸 수 있어요';
    for (let i = 1; i < BINS; i++) if (arr[i] < arr[i - 1]) return '왼쪽에서 오른쪽으로 오름차순이어야 해요';
    const cnt = {};
    for (const v of arr) {
      cnt[v] = (cnt[v] || 0) + 1;
      if (cnt[v] > 2) return '같은 숫자는 2개까지만 쓸 수 있어요';
    }
    if (arr.reduce((s, v) => s + v, 0) > MAXSUM) return '합계가 30을 넘었어요';
    return null;
  }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 유효한 배치를 무작위로 생성
  function randomArrangement() {
    const pool = [];
    for (let d = 0; d <= 9; d++) pool.push(d, d);
    for (;;) {
      const arr = shuffle(pool).slice(0, BINS).sort((x, y) => x - y);
      if (!validate(arr)) return arr;
    }
  }

  // 일부만 배치된 prefix를 유효한 배치로 완성(불가능하면 null)
  function completePrefix(prefix) {
    for (let t = 0; t < 800; t++) {
      const arr = prefix.slice();
      const cnt = {};
      arr.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
      while (arr.length < BINS) {
        const last = arr.length ? arr[arr.length - 1] : 0;
        const opts = [];
        for (let d = last; d <= 9; d++) if ((cnt[d] || 0) < 2) opts.push(d);
        if (!opts.length) break;
        const d = opts[Math.floor(Math.random() * opts.length)];
        arr.push(d);
        cnt[d] = (cnt[d] || 0) + 1;
      }
      if (!validate(arr)) return arr;
    }
    return null;
  }

  function create(arrA, arrB, lead) {
    if (validate(arrA) || validate(arrB)) throw new Error('invalid arrangement');
    return {
      arr: { a: arrA.slice(), b: arrB.slice() },
      used: { a: Array(BINS).fill(false), b: Array(BINS).fill(false) },
      score: { a: 0, b: 0 },
      round: 0,
      lead,
      pending: null,
      history: [],
      over: false,
    };
  }

  // 선공 제출. 공개되는 정보는 색상 단계뿐.
  function lead(G, who, bin) {
    if (G.over || G.pending || who !== G.lead) throw new Error('not your turn');
    if (!Number.isInteger(bin) || bin < 0 || bin >= BINS || G.used[who][bin]) throw new Error('invalid bin');
    G.pending = { who, bin };
    return { color: LEVEL[bin] };
  }

  // 후공 제출 → 양쪽 공개 및 승패 판정. 라운드 기록을 반환.
  function follow(G, bin) {
    if (G.over || !G.pending) throw new Error('no pending');
    const L = G.pending.who;
    const F = other(L);
    if (!Number.isInteger(bin) || bin < 0 || bin >= BINS || G.used[F][bin]) throw new Error('invalid bin');
    const bins = { [L]: G.pending.bin, [F]: bin };
    const vals = { a: G.arr.a[bins.a], b: G.arr.b[bins.b] };
    const winner = vals.a > vals.b ? 'a' : vals.a < vals.b ? 'b' : null;
    G.used.a[bins.a] = true;
    G.used.b[bins.b] = true;
    if (winner) G.score[winner] += 1;
    G.round += 1;
    const rec = { round: G.round, lead: L, bins, vals, winner };
    G.history.push(rec);
    if (winner) G.lead = winner; // 승자가 다음 선공, 무승부면 유지
    G.pending = null;
    if (G.round >= ROUNDS) G.over = true;
    return rec;
  }

  // 최종 승자 ('a' | 'b' | null=동점 → 재대결)
  function winner(G) {
    if (G.score.a === G.score.b) return null;
    return G.score.a > G.score.b ? 'a' : 'b';
  }

  // AI에게 줄 수 있는 "공개된 정보"만 담은 시점. 상대의 비공개 배치는 포함하지 않는다.
  function viewFor(G, who) {
    const opp = other(who);
    return {
      round: G.round,
      roundsLeft: ROUNDS - G.round,
      iLead: G.lead === who,
      myArr: G.arr[who].slice(),
      myUsed: G.used[who].slice(),
      myScore: G.score[who],
      oppScore: G.score[opp],
      oppColor: G.pending && G.pending.who === opp ? LEVEL[G.pending.bin] : null,
      revealed: G.history.map((h) => ({ color: LEVEL[h.bins[opp]], value: h.vals[opp] })),
    };
  }

  root.Gradation = { BINS, MAXSUM, ROUNDS, LEVEL, LEVEL_NAME, other, validate, randomArrangement, completePrefix, create, lead, follow, winner, viewFor };
  if (typeof module !== 'undefined') module.exports = root.Gradation;
})(typeof window !== 'undefined' ? window : globalThis);
