/* 컬러 링크 AI (외부 API 없음).
   탐색은 노드 한도를 둔 조각으로 나누고, 조각 사이에 setTimeout(0)을 끼워 화면이 멈추지 않게 한다.
   (한도를 넘긴 'unknown'은 절대 연결 불가능으로 확정하지 않는다) */
(function (root) {
  'use strict';
  const CL = root.ColorLink || (typeof require !== 'undefined' ? require('./colorlink.js') : null);

  const LV = {
    easy: { cands: 1, declBudget: 30000, detect: 0.6, falseDecl: 0.1, proveBudgets: [60000, 200000], mistake: 0.3 },
    normal: { cands: 8, declBudget: 200000, detect: 1, falseDecl: 0, proveBudgets: [100000, 600000, 2000000], mistake: 0 },
    hard: { cands: 16, declBudget: 800000, detect: 1, falseDecl: 0, proveBudgets: [200000, 1000000, 4000000, 10000000], mistake: 0 },
  };

  const later = (fn) => setTimeout(fn, 0);

  // 한 단계씩(비동기) 목록을 처리
  function eachAsync(list, fn, done) {
    let i = 0;
    (function tick() {
      if (i >= list.length) return done();
      fn(list[i++]);
      later(tick);
    })();
  }

  /**
   * 이번 차례의 배치를 고른다. cb(list) 로 [{cell,color}, ...] 반환.
   * - 쉬움: 무작위 합법 수. 가끔(mistake) 연결 불가능해지는 수도 그대로 둔다.
   * - 보통/어려움: 후보 여러 개를 탐색해 "연결 가능하지만 찾기 어려운"(탐색량이 큰) 배치를 선호.
   */
  function chooseTurn(S, need, level, cb) {
    const cfg = LV[level] || LV.normal;
    const cands = [];
    for (let i = 0; i < cfg.cands; i++) cands.push(CL.randomPlacement(S, need));
    const scored = [];
    eachAsync(
      cands,
      (pl) => {
        const T = CL.cloneState(S);
        CL.applyPlacement(T, pl);
        const r = CL.solve(T, { maxNodes: level === 'easy' ? 30000 : 120000 });
        scored.push({ pl, status: r.status, nodes: r.nodes });
      },
      () => {
        if (level === 'easy') {
          const ok = scored.find((s) => s.status !== 'impossible');
          // 쉬움은 가끔 불가능해지는 수를 그냥 둔다(전략적 실수)
          return cb(ok && Math.random() > cfg.mistake ? ok.pl : scored[0].pl);
        }
        const possible = scored.filter((s) => s.status === 'possible').sort((a, b) => b.nodes - a.nodes);
        if (possible.length && level === 'hard' && need >= 1) {
          // 2수 앞: 상대가 놓을 수 있는 "안전한 수"(놓은 뒤에도 연결 가능)가 가장 적은 배치를 고른다
          const top = possible.slice(0, 5);
          eachAsync(
            top,
            (cand) => {
              const T = CL.cloneState(S);
              CL.applyPlacement(T, cand.pl);
              let safe = 0;
              const SAMPLES = 12;
              for (let k = 0; k < SAMPLES; k++) {
                if (!CL.canPlace(T, 2)) break;
                const U = CL.cloneState(T);
                CL.applyPlacement(U, CL.randomPlacement(U, 2));
                if (CL.solve(U, { maxNodes: 40000 }).status !== 'impossible') safe++; // unknown은 안전 쪽으로 간주(보수적)
              }
              cand.safe = safe;
            },
            () => {
              top.sort((a, b) => a.safe - b.safe || b.nodes - a.nodes);
              cb(top[0].pl);
            }
          );
          return;
        }
        if (possible.length) return cb(possible[0].pl); // 상대가 연결하기 어려운(탐색량 큰) 판
        const unknown = scored.filter((s) => s.status === 'unknown');
        if (unknown.length) return cb(unknown[0].pl);
        cb(scored[0].pl); // 전부 불가능이면(이미 불가능한 판) 아무 수
      }
    );
  }

  /** 상대가 만든 판이 연결 불가능한지 확인해 선언 여부를 결정. cb(boolean) */
  function shouldDeclare(S, level, cb) {
    const cfg = LV[level] || LV.normal;
    later(() => {
      const r = CL.solve(S, { maxNodes: cfg.declBudget });
      if (r.status === 'impossible') return cb(Math.random() < cfg.detect);
      if (r.status === 'possible') return cb(Math.random() < cfg.falseDecl); // 쉬움: 잘못된 선언
      cb(false); // unknown: 확정할 수 없으므로 선언하지 않음
    });
  }

  /** 증명자일 때 실제 연결 경로를 생성. cb(paths|null). 예산을 단계적으로 늘려 가며 시도 */
  function prove(S, level, cb) {
    const budgets = (LV[level] || LV.normal).proveBudgets;
    let k = 0;
    (function attempt() {
      if (k >= budgets.length) return cb(null);
      const r = CL.solve(S, { maxNodes: budgets[k++] });
      if (r.status === 'possible') return cb(r.paths);
      if (r.status === 'impossible') return cb(null); // 실제로 불가능 → 증명 불가
      later(attempt);
    })();
  }

  root.ColorLinkAI = { chooseTurn, shouldDeclare, prove, LV };
  if (typeof module !== 'undefined') module.exports = root.ColorLinkAI;
})(typeof window !== 'undefined' ? window : globalThis);
