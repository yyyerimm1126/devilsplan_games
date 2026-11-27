/* 무거운 13 규칙 엔진 (DOM 의존 없음) */
(function (root) {
  'use strict';

  const COLORS = ['red', 'green', 'blue'];
  const NAME = { red: '빨강', green: '초록', blue: '파랑', rainbow: '레인보우' };
  const LIMIT = 13;
  const SET = 7; // 한 세트 7라운드
  const ROUNDS = 14; // 2세트

  function deal(G) {
    G.order.forEach((id) => {
      G.hands[id] = { cards: [0, 1, 2, 3, 4, 5, 6], chips: { red: 2, green: 2, blue: 2, rainbow: 1 } };
    });
  }

  // ids: 시계방향 좌석 순서, leadId: 첫 라운드의 선
  function create(ids, leadId) {
    const G = { order: ids.slice(), lead: leadId, round: 0, pedestals: { red: [], green: [], blue: [] }, hands: {}, penalty: {}, lastPen: {} };
    ids.forEach((id) => { G.penalty[id] = 0; G.lastPen[id] = 0; });
    deal(G);
    return G;
  }

  const sumOf = (G, col) => G.pedestals[col].reduce((a, b) => a + b, 0);
  const finished = (G) => G.round >= ROUNDS;

  // 새 세트 시작 시 카드·칩 재지급 (받침대 큐브는 유지)
  function startRound(G) {
    if (G.round > 0 && G.round % SET === 0) deal(G);
  }

  function options(G, id) {
    const h = G.hands[id];
    const out = [];
    h.cards.forEach((c) => Object.keys(h.chips).forEach((k) => { if (h.chips[k] > 0) out.push({ card: c, chip: k }); }));
    return out;
  }

  function validSubmit(G, id, card, chip) {
    const h = G.hands[id];
    return h.cards.includes(card) && h.chips[chip] > 0;
  }

  function randomSubmit(G, id) {
    const o = options(G, id);
    return o[Math.floor(Math.random() * o.length)];
  }

  function bestColor(G, c) {
    let best = null;
    COLORS.forEach((col) => {
      const s = sumOf(G, col) + c;
      const o = { col, safe: s < LIMIT, s, cnt: G.pedestals[col].length };
      if (!best || (o.safe && !best.safe) || (o.safe === best.safe && (o.safe ? o.s > best.s : o.cnt < best.cnt))) best = o;
    });
    return best;
  }

  function riskOf(G, card, chip) {
    if (chip === 'rainbow') return bestColor(G, card);
    const s = sumOf(G, chip) + card;
    return { col: chip, safe: s < LIMIT, s, cnt: G.pedestals[chip].length };
  }

  // AI 제출: 안전한 선택을 우선(큰 카드를 안전하게 소모), 없으면 큐브 수가 적은 곳, 가끔 도박
  function aiSubmit(G, id) {
    const scored = options(G, id).map((o) => ({ o, r: riskOf(G, o.card, o.chip) }));
    const safe = scored.filter((x) => x.r.safe);
    let pool;
    if (safe.length && Math.random() > 0.1) {
      safe.forEach((x) => (x.score = x.r.s + (x.o.chip === 'rainbow' ? -4 : 0) + Math.random() * 3));
      pool = safe;
    } else {
      scored.forEach((x) => (x.score = -x.r.cnt * 2 - x.o.card * 0.3 + (x.o.chip === 'rainbow' && x.r.safe ? 5 : 0) + Math.random()));
      pool = scored;
    }
    pool.sort((a, b) => b.score - a.score);
    return { card: pool[0].o.card, chip: pool[0].o.chip };
  }

  /**
   * 배치 시작. subs: { id: {card, chip} }
   * 순서: 레인보우 먼저(카드 높은 순) → 나머지(카드 높은 순), 동순위는 선 기준 시계방향.
   */
  function beginPlacement(G, subs) {
    const n = G.order.length;
    const lead = G.order.indexOf(G.lead);
    const dist = (id) => (G.order.indexOf(id) - lead + n) % n;
    const ids = Object.keys(subs);
    ids.forEach((id) => {
      const h = G.hands[id];
      h.cards.splice(h.cards.indexOf(subs[id].card), 1);
      h.chips[subs[id].chip] -= 1;
    });
    ids.sort((a, b) => {
      const ra = subs[a].chip === 'rainbow' ? 1 : 0;
      const rb = subs[b].chip === 'rainbow' ? 1 : 0;
      return rb - ra || subs[b].card - subs[a].card || dist(a) - dist(b);
    });
    return { subs, order: ids.slice(), queue: ids.slice(), deferred: [], passed: {}, done: {}, placedColor: {}, phase: 'main', lastPenId: null };
  }

  // 현재 차례. 없으면 null
  function current(G, P) {
    if (!P.queue.length && P.deferred.length) {
      // 패스한 순서의 역순(가장 늦게 패스한 사람부터)
      P.queue = P.deferred.slice().reverse();
      P.deferred = [];
      P.phase = 'deferred';
    }
    if (!P.queue.length) return null;
    const id = P.queue[0];
    return { id, card: P.subs[id].card, chip: P.subs[id].chip, canPass: P.phase === 'main' && !P.passed[id] };
  }

  function pass(G, P, id) {
    P.queue.shift();
    P.deferred.push(id);
    P.passed[id] = true;
    return { type: 'pass', id };
  }

  function place(G, P, id, color) {
    const sub = P.subs[id];
    if (sub.chip !== 'rainbow') color = sub.chip;
    P.queue.shift();
    const ped = G.pedestals[color];
    const before = ped.slice();
    const total = before.reduce((a, b) => a + b, 0) + sub.card;
    const ev = { type: 'place', id, color, value: sub.card, exploded: false, taken: 0, total };
    if (total >= LIMIT) {
      ev.exploded = true;
      ev.taken = before.length;
      G.pedestals[color] = [sub.card]; // 방금 올린 큐브는 남고 기존 큐브는 모두 가져감
      G.penalty[id] += before.length;
      if (before.length) { G.lastPen[id] = G.round + 1; P.lastPenId = id; }
    } else {
      ped.push(sub.card);
    }
    P.done[id] = true;
    P.placedColor[id] = color;
    return ev;
  }

  function endRound(G, P) {
    G.round += 1;
    if (P.lastPenId) G.lead = P.lastPenId; // 마지막으로 벌점을 받은 사람이 다음 선
  }

  // AI 배치 결정: 터질 것 같으면 (가능하면) 패스
  function aiAct(G, P, id) {
    const sub = P.subs[id];
    const color = sub.chip === 'rainbow' ? bestColor(G, sub.card).col : sub.chip;
    const explode = sumOf(G, color) + sub.card >= LIMIT;
    const cur = current(G, P);
    const others = P.queue.length > 1 || P.deferred.length > 0;
    if (explode && cur && cur.canPass && others && Math.random() < 0.6) return { type: 'pass' };
    return { type: 'place', color };
  }

  root.Heavy13 = { COLORS, NAME, LIMIT, SET, ROUNDS, create, startRound, options, validSubmit, randomSubmit, aiSubmit, beginPlacement, current, pass, place, endRound, aiAct, sumOf, finished };
  if (typeof module !== 'undefined') module.exports = root.Heavy13;
})(typeof window !== 'undefined' ? window : globalThis);
