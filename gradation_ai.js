/* 그라데이션 AI (외부 API 없음). Gradation.viewFor()가 주는 공개 정보만 사용한다. */
(function (root) {
  'use strict';
  const E = root.Gradation || (typeof require !== 'undefined' ? require('./gradation.js') : null);
  const LEVEL = E.LEVEL;
  const BY_COLOR = [[0, 6], [1, 5], [2, 4], [3]];

  let prior = null;
  // 유효한 무작위 배치의 통 위치별 평균 숫자(사전 지식)
  function getPrior() {
    if (prior) return prior;
    const sum = Array(7).fill(0);
    const N = 1500;
    for (let k = 0; k < N; k++) E.randomArrangement().forEach((v, i) => (sum[i] += v));
    prior = sum.map((s) => s / N);
    return prior;
  }

  const rnd = (n) => Math.floor(Math.random() * n);
  const unusedBins = (v) => v.myUsed.map((u, i) => (u ? -1 : i)).filter((i) => i >= 0);

  function arrange(level) {
    if (level === 'easy') return E.randomArrangement();
    const min = level === 'hard' ? 27 : 24;
    let a = null;
    for (let t = 0; t < 300; t++) {
      a = E.randomArrangement();
      if (a.reduce((s, x) => s + x, 0) >= min) return a;
    }
    return a;
  }

  // 보통: 색상별 사전 평균과 이미 공개된 숫자를 이용한 어림 추정
  function estimateOpp(v, color) {
    const pr = getPrior();
    if (color === 3) return pr[3];
    const [i, j] = BY_COLOR[color];
    const lo = pr[i], hi = pr[j];
    const seen = v.revealed.filter((r) => r.color === color);
    if (seen.length) return seen[0].value <= (lo + hi) / 2 ? hi : lo; // 한쪽이 낮게 나왔으면 남은 쪽은 높을 가능성
    return (lo + hi) / 2;
  }

  function normalChoose(v) {
    const un = unusedBins(v).sort((x, y) => v.myArr[x] - v.myArr[y]);
    if (v.iLead || v.oppColor === null) {
      // 선공: 가운데쯤 값을 위주로 (남은 라운드를 위해 극단값 아낌)
      const mid = (un.length - 1) / 2 + (Math.random() - 0.5) * un.length * 0.6;
      return un[Math.max(0, Math.min(un.length - 1, Math.round(mid)))];
    }
    const est = estimateOpp(v, v.oppColor);
    const beat = un.find((b) => v.myArr[b] > est + 0.3);
    return beat !== undefined ? beat : un[0]; // 이기기 어려우면 가장 작은 값을 버림
  }

  // 공개된 (색, 숫자)들과 모순 없는 상대 배치의 "사용된 통" 집합들
  function masks(arr, revealed) {
    const out = new Set();
    (function rec(i, mask) {
      if (i === revealed.length) { out.add(mask); return; }
      const r = revealed[i];
      for (const b of BY_COLOR[r.color]) {
        if ((mask >> b) & 1) continue;
        if (arr[b] !== r.value) continue;
        rec(i + 1, mask | (1 << b));
      }
    })(0, 0);
    return Array.from(out);
  }

  // 어려움: 가능한 상대 배치를 추론(표본)하고 통마다 예상 승률을 계산
  function hardChoose(v) {
    const un = unusedBins(v);
    const samples = [];
    for (let t = 0; t < 6000 && samples.length < 200; t++) {
      const a = E.randomArrangement();
      const ms = masks(a, v.revealed);
      if (ms.length) samples.push({ a, ms });
    }
    if (!samples.length) return normalChoose(v);
    let best = -Infinity, bestBin = un[0];
    un.forEach((b) => {
      const mv = v.myArr[b];
      let win = 0, lose = 0, n = 0;
      samples.forEach((s) =>
        s.ms.forEach((mask) => {
          let cands = [];
          for (let i = 0; i < 7; i++) if (!((mask >> i) & 1)) cands.push(i);
          if (v.oppColor !== null) cands = cands.filter((i) => LEVEL[i] === v.oppColor);
          cands.forEach((i) => {
            n++;
            if (mv > s.a[i]) win++;
            else if (mv < s.a[i]) lose++;
          });
        })
      );
      const diff = n ? (win - lose) / n : 0;
      const cost = v.roundsLeft > 1 ? 0.06 * (mv / 9) : 0; // 높은 숫자는 뒤 라운드를 위해 아낌
      const u = diff - cost + Math.random() * 0.01;
      if (u > best) { best = u; bestBin = b; }
    });
    return bestBin;
  }

  function choose(level, view) {
    if (level === 'easy') {
      const un = unusedBins(view);
      return un[rnd(un.length)];
    }
    return level === 'hard' ? hardChoose(view) : normalChoose(view);
  }

  root.GradAI = { arrange, choose };
  if (typeof module !== 'undefined') module.exports = root.GradAI;
})(typeof window !== 'undefined' ? window : globalThis);
