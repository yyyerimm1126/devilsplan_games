/* 탈락제 코어 로직 (DOM 의존 없음) */
(function (root) {
  'use strict';

  const GAMES = {
    memorypoker: { id: 'memorypoker', name: '기억포커', implemented: true },
    codebreak: { id: 'codebreak', name: '비밀 코드 해독', implemented: true },
    heavy13: { id: 'heavy13', name: '무거운 13', implemented: true },
    wallgo: { id: 'wallgo', name: '벽바둑', implemented: true },
    gradation: { id: 'gradation', name: '그라데이션', implemented: true },
    colorlink: { id: 'colorlink', name: '컬러 링크', implemented: true },
  };

  // 한 판에 탈락시키는 인원 = ceil((남은 인원 - 1) / 남은 판 수)
  function dropCount(remaining, roundsLeft) {
    return Math.ceil((remaining - 1) / roundsLeft);
  }

  // 인원 n, 판 수 R일 때 판별 탈락 인원 계획. 예: 6인 3판 → [2,2,1]
  function plan(n, rounds) {
    const out = [];
    let remaining = n;
    for (let r = 1; r <= rounds; r++) {
      const d = dropCount(remaining, rounds - r + 1);
      out.push(d);
      remaining -= d;
    }
    return out;
  }

  function roundsRange(n) {
    return { min: 2, max: Math.max(2, n - 1) };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const AI_NAMES = ['AI 알파', 'AI 베타', 'AI 감마', 'AI 델타', 'AI 엡실론', 'AI 제타', 'AI 에타', 'AI 세타'];

  function createState(humanName, totalPlayers, totalRounds) {
    const players = [{ id: 'p0', name: humanName, isAI: false, alive: true, history: [], elimRound: null, elimPos: null }];
    for (let i = 1; i < totalPlayers; i++) {
      players.push({
        id: 'p' + i,
        name: AI_NAMES[i - 1],
        isAI: true,
        memory: 0.7 + Math.random() * 0.25, // 기억 확률(70~95%)
        alive: true,
        history: [],
        elimRound: null,
        elimPos: null,
      });
    }
    return { players, totalRounds, round: 0, lastGame: null, finished: false };
  }

  function alivePlayers(state) {
    return state.players.filter((p) => p.alive);
  }

  // 다음 판 게임 선택: 벽바둑은 남은 인원 2~3명일 때만, 직전 판과 같은 게임은 가능하면 피함
  function pickGame(state) {
    const remaining = alivePlayers(state).length;
    // 벽바둑: 남은 인원 2~3명일 때만 / 그라데이션(1:1): 남은 인원 2명일 때만
    let cand = Object.keys(GAMES).filter((id) => {
      if (id === 'wallgo') return remaining >= 2 && remaining <= 3;
      if (id === 'gradation' || id === 'colorlink') return remaining === 2; // 1:1 게임
      return true;
    });
    const noRepeat = cand.filter((id) => id !== state.lastGame);
    if (noRepeat.length) cand = noRepeat;
    return cand[Math.floor(Math.random() * cand.length)];
  }

  // key 배열 사전식 비교: 큰 쪽이 앞(양수면 b가 더 좋음 → a,b 정렬용으로 내림차순)
  function cmpKeyDesc(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] === undefined ? -Infinity : a[i];
      const y = b[i] === undefined ? -Infinity : b[i];
      if (x !== y) return y - x; // 높은 key가 앞
    }
    return 0;
  }

  // 이전 판 성적 비교: history는 정규화 순위(0=1위 ~ 1=꼴찌). 최근 판부터 비교, 나쁜 쪽(큰 값)이 뒤.
  function cmpHistory(pa, pb) {
    const ha = pa.history, hb = pb.history;
    const n = Math.min(ha.length, hb.length);
    for (let i = 1; i <= n; i++) {
      const x = ha[ha.length - i], y = hb[hb.length - i];
      if (x !== y) return x - y; // 작은 값(좋은 성적)이 앞
    }
    return 0;
  }

  /**
   * 한 판 결과 확정.
   * entries: [{ id, key:[...높을수록 좋음], tb: 숫자(클수록 나쁨, 첫 판 동점 보조기준) }]
   * 반환: { order:[{id,key,rank}], eliminated:[id...], boundaryTie:boolean, finished }
   */
  function resolveRound(state, entries) {
    state.round += 1;
    const roundNo = state.round;
    const roundsLeft = state.totalRounds - roundNo + 1;
    const byId = {};
    state.players.forEach((p) => (byId[p.id] = p));

    // 동점은 한 번만 무작위로 정해 비교가 일관되게 함
    const rnd = {};
    entries.forEach((e) => (rnd[e.id] = Math.random()));

    const sorted = entries.slice().sort((a, b) => {
      const c = cmpKeyDesc(a.key, b.key);
      if (c) return c;
      const h = cmpHistory(byId[a.id], byId[b.id]);
      if (h) return h;
      const t = (a.tb || 0) - (b.tb || 0);
      if (t) return t;
      return rnd[a.id] - rnd[b.id];
    });

    const n = sorted.length;
    const drop = Math.min(dropCount(n, roundsLeft), n - 1);
    const order = sorted.map((e, i) => ({ id: e.id, key: e.key, rank: i + 1 }));

    // 탈락 경계(꼴찌 drop명 vs 그 위) 동점 여부
    const boundaryTie = drop > 0 && drop < n && cmpKeyDesc(sorted[n - drop - 1].key, sorted[n - drop].key) === 0;

    // 이전 판 성적 기록(정규화 순위)
    order.forEach((o, i) => byId[o.id].history.push(n > 1 ? i / (n - 1) : 0));

    const eliminated = [];
    for (let i = n - drop; i < n; i++) {
      const p = byId[order[i].id];
      p.alive = false;
      p.elimRound = roundNo;
      p.elimPos = i + 1;
      eliminated.push(p.id);
    }

    state.finished = alivePlayers(state).length <= 1;
    return { order, eliminated, boundaryTie, finished: state.finished, round: roundNo };
  }

  // 최종 순위: 우승자 1위 → 늦게 탈락한 순. 같은 판 탈락자는 그 판 순위 순.
  function finalStandings(state) {
    const alive = alivePlayers(state);
    const dead = state.players
      .filter((p) => !p.alive)
      .sort((a, b) => b.elimRound - a.elimRound || a.elimPos - b.elimPos);
    return alive.concat(dead).map((p, i) => ({ id: p.id, name: p.name, rank: i + 1, elimRound: p.elimRound }));
  }

  root.Core = { GAMES, dropCount, plan, roundsRange, shuffle, createState, alivePlayers, pickGame, resolveRound, finalStandings, cmpKeyDesc };
  if (typeof module !== 'undefined') module.exports = root.Core;
})(typeof window !== 'undefined' ? window : globalThis);
