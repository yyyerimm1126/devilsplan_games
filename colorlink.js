/* 컬러 링크 규칙 엔진 (DOM·AI 의존 없음)
   - 판/배치 검증/경로 검증/연결 가능성 탐색(백트래킹)
   - 확인되지 않은 방송 규칙은 CFG 상수로 분리했다. 바꿀 때는 여기만 고치면 된다. */
(function (root) {
  'use strict';

  const CFG = {
    MIN_LEN: 6, // 경로 최소 칸 수(시작·도착 포함)
    PLACE_SEC: 60, // 차례당 배치 제한 시간 (요청서 3분 / 튜토리얼 이미지 1분 → 이미지 값 적용)
    PROOF_SEC: 120, // 연결 증명 제한 시간 (요청서 5분 / 이미지 2분 → 이미지 값 적용)
    WIN_SCORE: 3, // 3점 선취 모드
    COLORS: 14, // A~N
    PER_COLOR: 2,
  };
  const LETTERS = 'ABCDEFGHIJKLMN';

  // X = 사용 가능한 칸, . = 구멍
  const MAPS = [
    { id: 'classic', name: '클래식 7×7', level: '보통', rows: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'] },
    { id: 'rooms', name: '네 방', level: '쉬움', rows: ['XXX.XXX', 'XXXXXXX', 'XXX.XXX', '.X...X.', 'XXX.XXX', 'XXXXXXX', 'XXX.XXX'] },
    { id: 'donut', name: '도넛', level: '보통', rows: ['XXXXXXX', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XXXXXXX'] },
    { id: 'stairs', name: '계단', level: '보통', rows: ['X.......', 'XX......', 'XXX.....', 'XXXX....', 'XXXXX...', 'XXXXXX..', 'XXXXXXX.', 'XXXXXXXX'] },
    { id: 'heart', name: '하트', level: '어려움', rows: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'] },
  ];

  function makeBoard(id, rowsOverride) {
    const m = MAPS.find((x) => x.id === id) || MAPS[0];
    const rows = rowsOverride || m.rows;
    const R = rows.length, C = rows[0].length, N = R * C;
    const mask = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) mask.push(rows[r][c] === 'X' ? 1 : 0);
    const adj = Array.from({ length: N }, () => []);
    let total = 0;
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        if (!mask[i]) continue;
        total++;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < R && nc >= 0 && nc < C && mask[nr * C + nc]) adj[i].push(nr * C + nc);
        });
      }
    }
    return { id: m.id, name: m.name, level: m.level, R, C, N, mask, adj, total };
  }

  const newState = (board) => ({ board, cells: Array(board.N).fill(-1), counts: Array(CFG.COLORS).fill(0) });
  const cloneState = (S) => ({ board: S.board, cells: S.cells.slice(), counts: S.counts.slice() });

  function piecesOf(S) {
    const p = Array.from({ length: CFG.COLORS }, () => []);
    S.cells.forEach((c, i) => { if (c >= 0) p[c].push(i); });
    return p;
  }

  // 한 차례의 배치(list=[{cell,color}]) 검증. need = 이번 차례에 놓아야 하는 개수(1 또는 2)
  function checkPlacement(S, list, need) {
    if (!Array.isArray(list) || list.length !== need) return `말 ${need}개를 배치해야 해요`;
    const colors = new Set(), cells = new Set();
    for (const { cell, color } of list) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= S.board.N || !S.board.mask[cell]) return '판 밖의 칸이에요';
      if (!Number.isInteger(color) || color < 0 || color >= CFG.COLORS) return '없는 색이에요';
      if (S.cells[cell] !== -1) return '이미 말이 있는 칸이에요';
      if (cells.has(cell)) return '같은 칸에 두 개를 놓을 수 없어요';
      if (colors.has(color)) return '같은 차례에 같은 색 말 2개는 놓을 수 없어요';
      if (S.counts[color] >= CFG.PER_COLOR) return `${LETTERS[color]} 색은 이미 2개가 놓였어요`;
      colors.add(color);
      cells.add(cell);
    }
    return null;
  }

  function applyPlacement(S, list) {
    list.forEach(({ cell, color }) => { S.cells[cell] = color; S.counts[color]++; });
  }

  // 이번 차례에 놓을 수 있는 상태인지 (칸·색 모두 need개 이상 남았는지)
  function canPlace(S, need) {
    let empties = 0, colors = 0;
    for (let i = 0; i < S.board.N; i++) if (S.board.mask[i] && S.cells[i] === -1) empties++;
    for (let c = 0; c < CFG.COLORS; c++) if (S.counts[c] < CFG.PER_COLOR) colors++;
    return empties >= need && colors >= need;
  }

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomPlacement(S, need) {
    const colors = shuffle([...Array(CFG.COLORS).keys()].filter((c) => S.counts[c] < CFG.PER_COLOR)).slice(0, need);
    const cells = shuffle([...Array(S.board.N).keys()].filter((i) => S.board.mask[i] && S.cells[i] === -1)).slice(0, need);
    return colors.map((color, k) => ({ cell: cells[k], color }));
  }

  /**
   * 연결 증명 검증. paths: { 색번호: [칸 인덱스, ...] }
   * - 짝이 둘 다 있는 색: 두 말을 잇는 경로
   * - 짝이 하나뿐인 색: 그 말에서 시작해 끝칸(가상의 짝)이 빈칸인 경로
   */
  function validateProof(S, paths, minLen) {
    minLen = minLen || CFG.MIN_LEN;
    const errors = [];
    const board = S.board;
    const pieces = piecesOf(S);
    const owner = new Map();
    for (let c = 0; c < CFG.COLORS; c++) {
      const p = pieces[c];
      let path = paths && paths[c];
      if (!p.length) {
        if (path && path.length) errors.push(`${LETTERS[c]}: 아직 놓이지 않은 색이에요`);
        continue;
      }
      if (!path || !path.length) { errors.push(`${LETTERS[c]}: 경로가 없어요`); continue; }
      const err = (m) => errors.push(`${LETTERS[c]}: ${m}`);
      if (path.length < minLen) err(`${minLen}칸 이상이어야 해요 (${path.length}칸)`);
      const seen = new Set();
      let inBoard = true;
      path.forEach((cell) => {
        if (!Number.isInteger(cell) || cell < 0 || cell >= board.N || !board.mask[cell]) { inBoard = false; return; }
        if (seen.has(cell)) err('같은 칸을 두 번 지나요');
        seen.add(cell);
      });
      if (!inBoard) { err('판 밖의 칸이 있어요'); continue; }
      for (let k = 1; k < path.length; k++) if (!board.adj[path[k - 1]].includes(path[k])) { err('상하좌우로만 이어져야 해요'); break; }
      if (p.length === 1 && path[path.length - 1] === p[0]) path = path.slice().reverse();
      const s = path[0], e = path[path.length - 1];
      if (p.length === 2) {
        if (!((s === p[0] && e === p[1]) || (s === p[1] && e === p[0]))) err('같은 색 두 말을 이어야 해요');
        for (let k = 1; k < path.length - 1; k++) if (S.cells[path[k]] !== -1) { err('다른 말이 있는 칸을 지날 수 없어요'); break; }
      } else {
        if (s !== p[0]) err('놓인 말에서 시작해야 해요');
        for (let k = 1; k < path.length; k++) if (S.cells[path[k]] !== -1) { err('가상의 짝 칸과 경로는 빈칸이어야 해요'); break; }
      }
      path.forEach((cell) => {
        if (owner.has(cell) && owner.get(cell) !== c) err(`${LETTERS[owner.get(cell)]} 경로와 겹쳐요`);
        else owner.set(cell, c);
      });
    }
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
  }

  /**
   * 모든 색의 경로가 동시에 성립하는지 백트래킹(DFS)으로 탐색.
   * 반환 status: 'possible'(paths 포함) | 'impossible'(전체 탐색 완료) | 'unknown'(노드 한도 초과: 불가능으로 확정하지 않음)
   * - 짝이 하나뿐인 색은 가상의 짝 위치를 자유롭게 정할 수 있으므로, 경로를 앞의 6칸으로 잘라도 된다
   *   (잘라 낸 칸은 원래 경로의 부분집합이라 다른 색과 겹치지 않는다) → 정확히 minLen칸만 탐색.
   * - 가지치기: 칸 수 부족, 남은 색의 도달 가능성(BFS), 경로 길이 하한.
   */
  function solve(S, opts) {
    opts = opts || {};
    const minLen = opts.minLen || CFG.MIN_LEN;
    const maxNodes = opts.maxNodes || 150000;
    const board = S.board, N = board.N, adj = board.adj;
    const pieces = piecesOf(S);
    const cols = [];
    for (let c = 0; c < CFG.COLORS; c++) if (pieces[c].length) cols.push({ c, a: pieces[c][0], b: pieces[c].length > 1 ? pieces[c][1] : -1, p: pieces[c].length });
    if (!cols.length) return { status: 'possible', paths: {}, nodes: 0 };
    if (cols.length * minLen > board.total) return { status: 'impossible', nodes: 0, reason: '칸 부족' };

    const isPiece = new Uint8Array(N);
    pieces.forEach((l) => l.forEach((x) => (isPiece[x] = 1)));
    const used = new Uint8Array(N);
    const freeNb = (cell) => adj[cell].filter((x) => !isPiece[x]).length;
    cols.sort((x, y) => {
      if ((x.b >= 0) !== (y.b >= 0)) return x.b >= 0 ? -1 : 1; // 짝이 있는 색(제약 큼) 먼저
      return freeNb(x.a) + (x.b >= 0 ? freeNb(x.b) : 0) - (freeNb(y.a) + (y.b >= 0 ? freeNb(y.b) : 0)); // 주변이 좁은 색 먼저
    });
    const needFrom = new Array(cols.length + 1).fill(0);
    for (let i = cols.length - 1; i >= 0; i--) needFrom[i] = needFrom[i + 1] + (minLen - cols[i].p);
    let freeCnt = 0;
    for (let i = 0; i < N; i++) if (board.mask[i] && !isPiece[i]) freeCnt++;
    if (needFrom[0] > freeCnt) return { status: 'impossible', nodes: 0, reason: '빈칸 부족' };

    // 목표 방향이 가까운 이웃부터 탐색(짧고 곧은 경로를 먼저 시도)
    const R = board.R, C = board.C;
    const ordered = cols.map((cl) => {
      if (cl.b < 0) return null;
      const br = Math.floor(cl.b / C), bc = cl.b % C;
      return adj.map((nb) => nb.slice().sort((x, y) => Math.abs(Math.floor(x / C) - br) + Math.abs((x % C) - bc) - (Math.abs(Math.floor(y / C) - br) + Math.abs((y % C) - bc))));
    });

    let nodes = 0, aborted = false, nodeLimit = maxNodes, lenCap = Infinity, capHit = false;
    const dist = new Int16Array(N), seen = new Int32Array(N), queue = new Int16Array(N);
    let stamp = 0;
    // to>=0: from→to 최단 걸음 수(-1이면 도달 불가) / to<0: from이 속한 빈 공간의 크기
    function bfs(from, to) {
      stamp++;
      let h = 0, t = 0, count = 1;
      queue[t++] = from; seen[from] = stamp; dist[from] = 0;
      while (h < t) {
        const x = queue[h++];
        if (x === to) return dist[x];
        const nb = adj[x];
        for (let k = 0; k < nb.length; k++) {
          const y = nb[k];
          if (seen[y] === stamp) continue;
          if (y !== to && (isPiece[y] || used[y])) continue;
          seen[y] = stamp; dist[y] = dist[x] + 1; queue[t++] = y; count++;
        }
      }
      return to >= 0 ? -1 : count;
    }

    const paths = new Array(cols.length).fill(null);

    function next(i) {
      if (i === cols.length) return true;
      if (needFrom[i] > freeCnt) return false;
      for (let j = i; j < cols.length; j++) {
        const cl = cols[j];
        if (cl.b >= 0) { if (bfs(cl.a, cl.b) < 0) return false; }
        else if (bfs(cl.a, -1) < minLen) return false;
      }
      const path = [cols[i].a];
      paths[i] = path;
      return cols[i].b >= 0 ? dfsPaired(i, cols[i].a, 1, path) : dfsUnpaired(i, cols[i].a, 1, path);
    }

    function dfsPaired(i, cur, len, path) {
      if (++nodes > nodeLimit) { aborted = true; return false; }
      const b = cols[i].b;
      if (cur === b) return len >= minLen && next(i + 1);
      const d = bfs(cur, b);
      if (d < 0) return false;
      if (len + d > lenCap) { capHit = true; return false; } // 이번 시도의 길이 상한
      const addFree = Math.max(len + d, minLen) - len - 1; // 이 경로가 앞으로 더 쓰는 빈칸 수(하한)
      if (addFree + needFrom[i + 1] > freeCnt) return false;
      const nb = ordered[i][cur];
      for (let k = 0; k < nb.length; k++) {
        const y = nb[k];
        if (y === b) {
          if (len + 1 < minLen) continue;
          path.push(y);
          if (dfsPaired(i, y, len + 1, path)) return true;
          path.pop();
          if (aborted) return false;
          continue;
        }
        if (isPiece[y] || used[y]) continue;
        used[y] = 1; freeCnt--; path.push(y);
        if (dfsPaired(i, y, len + 1, path)) return true;
        path.pop(); used[y] = 0; freeCnt++;
        if (aborted) return false;
      }
      return false;
    }

    function dfsUnpaired(i, cur, len, path) {
      if (++nodes > nodeLimit) { aborted = true; return false; }
      if (len === minLen) return next(i + 1);
      if (minLen - len + needFrom[i + 1] > freeCnt) return false;
      const nb = adj[cur];
      for (let k = 0; k < nb.length; k++) {
        const y = nb[k];
        if (isPiece[y] || used[y]) continue;
        used[y] = 1; freeCnt--; path.push(y);
        if (dfsUnpaired(i, y, len + 1, path)) return true;
        path.pop(); used[y] = 0; freeCnt++;
        if (aborted) return false;
      }
      return false;
    }

    // 길이 상한을 점차 늘려 가며 시도(짧은 경로 위주로 해를 빨리 찾음). 마지막 시도는 상한 없는 완전탐색.
    const caps = [minLen, minLen + 2, minLen + 5, minLen + 10, Infinity];
    let totalNodes = 0;
    for (let k = 0; k < caps.length; k++) {
      const last = k === caps.length - 1;
      lenCap = caps[k];
      nodes = 0;
      aborted = false;
      nodeLimit = last ? Math.max(1, maxNodes - totalNodes) : Math.max(1, Math.floor(maxNodes / 12));
      used.fill(0);
      freeCnt = 0;
      for (let i = 0; i < N; i++) if (board.mask[i] && !isPiece[i]) freeCnt++;
      const ok = next(0);
      totalNodes += nodes;
      if (ok) {
        const out = {};
        cols.forEach((cl, i) => (out[cl.c] = paths[i].slice()));
        return { status: 'possible', paths: out, nodes: totalNodes };
      }
      if (last) return { status: aborted ? 'unknown' : 'impossible', nodes: totalNodes };
      // 상한이 없는 효과(어떤 경로도 상한에 걸리지 않았음)면 이 시도가 이미 완전탐색이므로 바로 결론
      if (!aborted && !capHit) return { status: 'impossible', nodes: totalNodes };
      capHit = false;
    }
  }

  root.ColorLink = { CFG, LETTERS, MAPS, makeBoard, newState, cloneState, piecesOf, checkPlacement, applyPlacement, canPlace, randomPlacement, validateProof, solve, shuffle };
  if (typeof module !== 'undefined') module.exports = root.ColorLink;
})(typeof window !== 'undefined' ? window : globalThis);
