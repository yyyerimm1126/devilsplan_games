/* 벽바둑 규칙 엔진 (DOM 의존 없음) */
(function (root) {
  'use strict';

  const N = 7;
  const DR = [-1, 0, 1, 0]; // 0 위, 1 오른쪽, 2 아래, 3 왼쪽
  const DC = [0, 1, 0, -1];

  // 칸 (r,c)의 d방향 면의 키. 보드 바깥이면 null.
  // 'H r,c' = (r,c) 아래쪽 면, 'V r,c' = (r,c) 오른쪽 면
  function edgeKey(r, c, d) {
    if (d === 0) return r === 0 ? null : 'H' + (r - 1) + ',' + c;
    if (d === 2) return r === N - 1 ? null : 'H' + r + ',' + c;
    if (d === 1) return c === N - 1 ? null : 'V' + r + ',' + c;
    return c === 0 ? null : 'V' + r + ',' + (c - 1);
  }

  function create(order) {
    const n = order.length;
    const per = n === 2 ? 2 : 1; // 2인: 동그라미2+네모2 / 3인: 동그라미1+네모1
    const seq = [];
    for (let k = 0; k < per; k++) order.forEach((pid) => seq.push({ pid, type: 'circle' }));
    for (let k = 0; k < per; k++) order.forEach((pid) => seq.push({ pid, type: 'square' }));
    const breaks = {};
    order.forEach((id) => (breaks[id] = n === 3 ? 1 : 0)); // 벽 부수기: 3인만, 각자 1회
    return { order: order.slice(), walls: new Set(), pieces: [], phase: 'place', seq, seqIdx: 0, turn: 0, breaks, over: false, turns: 0 };
  }

  const pieceAt = (W, r, c) => W.pieces.find((p) => p.r === r && p.c === c) || null;

  function emptyCells(W) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!pieceAt(W, r, c)) out.push([r, c]);
    return out;
  }

  function place(W, r, c) {
    if (W.phase !== 'place' || pieceAt(W, r, c)) return false;
    const s = W.seq[W.seqIdx];
    W.pieces.push({ id: 'w' + W.pieces.length, owner: s.pid, type: s.type, r, c });
    W.seqIdx += 1;
    if (W.seqIdx >= W.seq.length) {
      W.phase = 'play';
      W.turn = 0;
      settle(W);
    }
    return true;
  }

  // ---------- 이동 ----------
  function stepFrom(W, r, c, d, mover, canBreak) {
    const k = edgeKey(r, c, d);
    if (k === null) return null;
    const nr = r + DR[d], nc = c + DC[d];
    if (W.pieces.some((q) => q !== mover && q.r === nr && q.c === nc)) return null;
    if (!W.walls.has(k)) return { r: nr, c: nc, broke: null };
    return canBreak ? { r: nr, c: nc, broke: k } : null;
  }

  // 말 p의 합법 이동 목록: [{to:[r,c], broke:key|null}] (같은 칸은 벽을 안 부수는 쪽 우선)
  function moves(W, p) {
    const allowBreak = W.breaks[p.owner] > 0;
    const map = new Map();
    const add = (to, broke) => {
      const key = to[0] + ',' + to[1];
      const old = map.get(key);
      if (!old || (old.broke && !broke)) map.set(key, { to, broke });
    };
    for (let d = 0; d < 4; d++) {
      if (p.type === 'square') {
        let r = p.r, c = p.c, broke = null;
        for (let k = 0; k < 2; k++) {
          const s = stepFrom(W, r, c, d, p, allowBreak && !broke);
          if (!s) break;
          r = s.r; c = s.c; broke = broke || s.broke;
          add([r, c], broke);
        }
      } else {
        const s1 = stepFrom(W, p.r, p.c, d, p, allowBreak);
        if (!s1) continue;
        add([s1.r, s1.c], s1.broke);
        [(d + 1) % 4, (d + 3) % 4].forEach((t) => {
          const s2 = stepFrom(W, s1.r, s1.c, t, p, allowBreak && !s1.broke);
          if (s2) add([s2.r, s2.c], s1.broke || s2.broke);
        });
      }
    }
    return Array.from(map.values());
  }

  function applyMove(W, p, mv) {
    if (mv.broke) {
      W.walls.delete(mv.broke);
      W.breaks[p.owner] -= 1;
    }
    p.r = mv.to[0];
    p.c = mv.to[1];
  }

  function facesWith(walls, r, c) {
    const out = [];
    for (let d = 0; d < 4; d++) {
      const k = edgeKey(r, c, d);
      if (k !== null && !walls.has(k)) out.push(d);
    }
    return out;
  }
  const wallFaces = (W, r, c) => facesWith(W.walls, r, c);

  function applyWall(W, r, c, d) {
    const k = edgeKey(r, c, d);
    if (k !== null) W.walls.add(k);
  }

  // ---------- 구역 분석 ----------
  function regionsOf(walls, pieces) {
    const cellRegion = Array.from({ length: N }, () => Array(N).fill(-1));
    const regions = [];
    for (let r0 = 0; r0 < N; r0++) {
      for (let c0 = 0; c0 < N; c0++) {
        if (cellRegion[r0][c0] !== -1) continue;
        const id = regions.length;
        const reg = { size: 0, counts: {} };
        const stack = [[r0, c0]];
        cellRegion[r0][c0] = id;
        while (stack.length) {
          const [r, c] = stack.pop();
          reg.size++;
          for (let d = 0; d < 4; d++) {
            const k = edgeKey(r, c, d);
            if (k === null || walls.has(k)) continue;
            const nr = r + DR[d], nc = c + DC[d];
            if (cellRegion[nr][nc] === -1) { cellRegion[nr][nc] = id; stack.push([nr, nc]); }
          }
        }
        regions.push(reg);
      }
    }
    pieces.forEach((p) => {
      const reg = regions[cellRegion[p.r][p.c]];
      reg.counts[p.owner] = (reg.counts[p.owner] || 0) + 1;
    });
    return { cellRegion, regions };
  }

  const allSingle = (regions) => regions.every((g) => Object.keys(g.counts).length <= 1);

  // 점수: 자기 말만 있는 구역의 칸 수 합 / 동률용 최대 단일 구역
  function scoresOf(regions, order) {
    const out = {};
    order.forEach((id) => (out[id] = { score: 0, max: 0 }));
    regions.forEach((g) => {
      const owners = Object.keys(g.counts);
      if (owners.length === 1) {
        out[owners[0]].score += g.size;
        out[owners[0]].max = Math.max(out[owners[0]].max, g.size);
      }
    });
    return out;
  }

  function analyze(W) {
    const a = regionsOf(W.walls, W.pieces);
    a.scores = scoresOf(a.regions, W.order);
    a.single = allSingle(a.regions);
    return a;
  }

  // ---------- 턴 진행 ----------
  const hasMove = (W, pid) => W.pieces.some((p) => p.owner === pid && moves(W, p).length > 0);

  // 현재 차례가 움직일 수 없으면 건너뜀. 종료 조건 판정.
  function settle(W) {
    if (allSingle(regionsOf(W.walls, W.pieces).regions)) { W.over = true; return; }
    const n = W.order.length;
    for (let i = 0; i < n; i++) {
      const idx = (W.turn + i) % n;
      if (hasMove(W, W.order[idx])) { W.turn = idx; return; }
    }
    W.over = true; // 아무도 움직일 수 없음
  }

  function endTurn(W) {
    W.turns += 1;
    W.turn = (W.turn + 1) % W.order.length;
    if (W.turns > 400) { W.over = true; return; }
    settle(W);
  }

  // ---------- AI ----------
  function evalState(walls, pieces, pid, order) {
    const { regions } = regionsOf(walls, pieces);
    if (allSingle(regions)) {
      const sc = scoresOf(regions, order);
      let other = -1;
      order.forEach((id) => { if (id !== pid) other = Math.max(other, sc[id].score); });
      return (sc[pid].score - other) * 5;
    }
    const share = {};
    order.forEach((id) => (share[id] = 0));
    regions.forEach((g) => {
      const tot = Object.keys(g.counts).reduce((s, k) => s + g.counts[k], 0);
      if (!tot) return;
      Object.keys(g.counts).forEach((k) => (share[k] += (g.size * g.counts[k]) / tot));
    });
    let other = 0;
    order.forEach((id) => { if (id !== pid) other = Math.max(other, share[id]); });
    return share[pid] - other;
  }

  // 1수 앞 탐색: 이동+벽 설치 조합 중 평가값이 가장 높은 수
  function aiTurn(W, pid) {
    let best = null, bestV = -Infinity;
    W.pieces.filter((p) => p.owner === pid).forEach((p) => {
      moves(W, p).forEach((mv) => {
        const walls = new Set(W.walls);
        if (mv.broke) walls.delete(mv.broke);
        const pcs = W.pieces.map((q) => (q === p ? { owner: q.owner, r: mv.to[0], c: mv.to[1] } : q));
        const faces = facesWith(walls, mv.to[0], mv.to[1]);
        (faces.length ? faces : [null]).forEach((d) => {
          const w2 = d === null ? walls : new Set(walls).add(edgeKey(mv.to[0], mv.to[1], d));
          const v = evalState(w2, pcs, pid, W.order) + Math.random() * 1.5 - (mv.broke ? 3 : 0);
          if (v > bestV) { bestV = v; best = { piece: p, mv, face: d }; }
        });
      });
    });
    return best;
  }

  function randomTurn(W, pid) {
    const cand = [];
    W.pieces.filter((p) => p.owner === pid).forEach((p) => moves(W, p).forEach((mv) => cand.push({ piece: p, mv })));
    if (!cand.length) return null;
    const pick = cand[Math.floor(Math.random() * cand.length)];
    const walls = new Set(W.walls);
    if (pick.mv.broke) walls.delete(pick.mv.broke);
    const faces = facesWith(walls, pick.mv.to[0], pick.mv.to[1]);
    return { piece: pick.piece, mv: pick.mv, face: faces.length ? faces[Math.floor(Math.random() * faces.length)] : null };
  }

  function aiPlace(W, pid) {
    const cells = emptyCells(W);
    let best = null, bestV = -Infinity;
    cells.forEach(([r, c]) => {
      let minD = 99;
      W.pieces.forEach((q) => { if (q.owner !== pid) minD = Math.min(minD, Math.abs(q.r - r) + Math.abs(q.c - c)); });
      const center = Math.abs(r - 3) + Math.abs(c - 3);
      const v = Math.min(minD, 6) - center * 0.3 + Math.random() * 2;
      if (v > bestV) { bestV = v; best = [r, c]; }
    });
    return best;
  }

  // 이번 한 수(이동+벽)를 엔진에 적용
  function applyTurn(W, t) {
    applyMove(W, t.piece, t.mv);
    if (t.face !== null) applyWall(W, t.piece.r, t.piece.c, t.face);
    endTurn(W);
  }

  root.Wallgo = { N, DR, DC, edgeKey, create, pieceAt, emptyCells, place, moves, applyMove, wallFaces, applyWall, regionsOf, analyze, endTurn, aiTurn, aiPlace, randomTurn, applyTurn };
  if (typeof module !== 'undefined') module.exports = root.Wallgo;
})(typeof window !== 'undefined' ? window : globalThis);
