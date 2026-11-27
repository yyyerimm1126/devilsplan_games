/* 화면·진행 (혼자 연습 모드) */
(function () {
  'use strict';

  const $app = document.getElementById('app');
  let S = null; // 게임 상태 (Core.createState)
  let ticker = null;
  const setup = { name: '나', n: 5, rounds: 3 };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = (id) => S.players.find((p) => p.id === id);
  const me = () => S.players[0];

  let stepTimer = null;
  const clProofHandlers = {}; // 컬러 링크 증명 화면의 칸 입력 (게임 시작 시 연결)
  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
    if (stepTimer) clearTimeout(stepTimer);
    stepTimer = null;
  }
  function show(html) {
    stopTicker();
    $app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ---------- 카드 표시 ---------- */
  function cardHtml(c, cls) {
    const red = c.suit === '♥' || c.suit === '♦';
    return `<div class="pcard ${red ? 'red' : ''} ${cls || ''}"><span class="r">${Poker.label(c.rank)}</span><span class="s">${c.suit}</span></div>`;
  }

  /* ---------- 홈 / 규칙 / 설정 ---------- */
  function home() {
    show(`
      <h1>탈락제 게임</h1>
      <p class="sub">친구들과 겨뤄 매 판 꼴찌가 탈락!<br>마지막 1명이 우승합니다.</p>
      <div class="card-box">
        <button class="btn" data-act="setup">혼자 연습 (나 + AI)</button>
        <button class="btn secondary" data-act="practiceMenu">게임 하나만 연습</button>
        <button class="btn secondary" data-act="rules">규칙 보기</button>
        <button class="btn secondary" disabled>방 만들기 / 입장 (준비 중)</button>
      </div>
      <p class="muted center">현재 구현: 탈락제 + 4개 게임(기억포커·비밀 코드 해독·무거운 13·벽바둑)</p>
    `);
  }

  function rules() {
    show(`
      <h2>규칙 보기</h2>
      <div class="card-box rules">
        <h3>탈락제</h3>
        <ul>
          <li>3~8명이 참가, 부족하면 AI가 채웁니다.</li>
          <li>방장(나)이 판 수 R을 정합니다. (2 ≤ R ≤ 인원−1)</li>
          <li>매 판 하위 ceil((남은 인원−1)/남은 판 수)명이 탈락합니다.</li>
          <li>탈락자는 관전만 하고, 마지막 1명이 우승합니다.</li>
          <li>최하위 동점이면 이전 판 성적이 나쁜 쪽이 탈락합니다.</li>
        </ul>
      </div>
      <div class="card-box rules">
        <h3>기억포커</h3>
        <ul>
          <li>4×4 격자의 카드 16장이 20초간 공개됩니다.</li>
          <li>카드가 가려지고 공유 카드 3장이 공개됩니다.</li>
          <li>격자에서 서로 다른 2곳을 고르면 공유 3장과 합쳐 5장 족보로 겨룹니다.</li>
          <li>포카드 &gt; 풀하우스 &gt; 트리플 &gt; 투페어 &gt; 원페어 &gt; 하이카드, 문양 무관, A가 가장 높음.</li>
          <li>선택 제한 시간 30초. 미제출은 최하위.</li>
        </ul>
      </div>
      <div class="card-box rules">
        <h3>비밀 코드 해독</h3>
        <ul>
          <li>카드 26장(A~Z)은 각각 숫자·색·도형을 가집니다.</li>
          <li>조건을 모두 만족하는 카드 4장 조합은 단 하나입니다. (조건 중 하나는 "○ 카드가 포함된다"로 확실히 알려 줍니다.)</li>
          <li>4장을 골라 제출하세요. 오답은 3회까지, 제한 시간 3분.</li>
          <li>빨리 맞힌 순으로 순위가 정해지고, 못 맞힌 사람은 오답이 적은 순입니다.</li>
        </ul>
      </div>
      <div class="card-box rules">
        <h3>무거운 13</h3>
        <ul>
          <li>공용 받침대 3개(빨강·초록·파랑). 14라운드(7라운드 × 2세트)를 진행합니다.</li>
          <li>매 라운드 카드(0~6) 1장과 칩 1개를 몰래 내고, 레인보우 칩은 받침대 색을 고를 수 있습니다.</li>
          <li>레인보우 먼저, 이후 높은 카드 순으로 큐브를 올립니다. 동순위는 선 기준 시계방향.</li>
          <li>라운드당 1회 패스로 차례를 뒤로 미룰 수 있습니다. (여럿이면 늦게 패스한 사람부터)</li>
          <li>합이 13 이상이면 폭발! 방금 올린 큐브는 남고, 기존 큐브 개수만큼 벌점을 받습니다.</li>
          <li>14라운드 후 벌점이 적은 순. 동점이면 최근에 벌점을 받은 사람이 아래.</li>
        </ul>
      </div>
      <div class="card-box rules">
        <h3>컬러 링크 (남은 인원 2명일 때만 등장)</h3>
        <ul>
          <li>A~N 14색 말(색마다 2개)을 번갈아 놓습니다. 선공은 1개, 이후 매 차례 서로 다른 색 2개.</li>
          <li>모든 색을 6칸 이상 경로로 이을 수 있어야 하고 경로끼리는 겹치거나 교차하면 안 됩니다.</li>
          <li>상대가 연결 불가능한 판을 만들었다고 생각하면 불가능 선언! 직전에 놓은 사람이 시간 안에 증명하지 못하면 선언한 사람이 승리합니다.</li>
        </ul>
      </div>
      <div class="card-box rules">
        <h3>그라데이션 (남은 인원 2명일 때만 등장)</h3>
        <ul>
          <li>0~9 큐브 중 7개를 오름차순으로 7개 통에 숨기고(합계 30 이하) 1:1로 겨룹니다.</li>
          <li>선공이 통을 내면 후공은 통의 색만 보고 응수합니다. 큰 숫자가 1점, 7라운드 뒤 점수가 높은 쪽 승리.</li>
        </ul>
      </div>
      <div class="card-box rules">
        <h3>벽바둑 (남은 인원 2~3명일 때만 등장)</h3>
        <ul>
          <li>7×7 보드. 말을 놓은 뒤, 차례마다 말 1개를 움직이고 그 말의 네 면 중 한 곳에 벽을 세웁니다.</li>
          <li>● 동그라미: 1칸 또는 1칸 이동 후 좌/우 90° 꺾어 1칸. ■ 네모: 직진 1~2칸.</li>
          <li>다른 말이나 벽을 넘을 수 없습니다. 3인전은 각자 1번 벽을 부수고 지나갈 수 있습니다.</li>
          <li>모든 구역에 한 플레이어의 말만 남으면 종료. 자기 말이 있는 구역의 칸 수 합이 많은 순(동률은 가장 큰 구역).</li>
          <li>2인: 동그라미 2 + 네모 2 / 3인: 동그라미 1 + 네모 1. 차례당 90초.</li>
        </ul>
      </div>
      <button class="btn secondary" data-act="home">돌아가기</button>
    `);
  }

  function clampSetup() {
    setup.n = Math.min(8, Math.max(3, setup.n));
    const r = Core.roundsRange(setup.n);
    setup.rounds = Math.min(r.max, Math.max(r.min, setup.rounds));
  }

  function setupScreen() {
    clampSetup();
    const r = Core.roundsRange(setup.n);
    const seg = (from, to, cur, act) => {
      let h = '';
      for (let i = from; i <= to; i++) h += `<button class="${i === cur ? 'on' : ''}" data-act="${act}" data-v="${i}">${i}</button>`;
      return `<div class="seg">${h}</div>`;
    };
    const p = Core.plan(setup.n, setup.rounds);
    show(`
      <h2>혼자 연습 설정</h2>
      <div class="card-box">
        <label class="field">이름
          <input type="text" id="nameInput" maxlength="8" value="${esc(setup.name)}" autocomplete="off">
        </label>
        <label class="field">참가 인원 (나 포함, 나머지는 AI)</label>
        ${seg(3, 8, setup.n, 'setN')}
        <label class="field">판 수 (${r.min}~${r.max})</label>
        ${seg(r.min, r.max, setup.rounds, 'setR')}
        <p class="muted">판별 탈락 인원: ${p.join(' → ')}명 (마지막에 1명 생존)</p>
      </div>
      <button class="btn" data-act="start">시작하기</button>
      <button class="btn secondary" data-act="home">돌아가기</button>
    `);
  }

  /* ---------- 진행 ---------- */
  function startGame() {
    clampSetup();
    S = Core.createState(setup.name.trim() || '나', setup.n, setup.rounds);
    roundIntro();
  }

  function roundIntro() {
    S.currentGame = Core.pickGame(S);
    const g = Core.GAMES[S.currentGame];
    const alive = Core.alivePlayers(S).length;
    const roundNo = S.round + 1;
    const drop = Core.dropCount(alive, S.totalRounds - S.round);
    show(`
      <div class="topbar"><span class="pill">${roundNo} / ${S.totalRounds}판</span><span class="pill ${me().alive ? 'ok' : 'warn'}">${me().alive ? '참가 중' : '관전 중'}</span></div>
      <div class="card-box center">
        <p class="muted">이번 판 게임</p>
        <h1>${g.name}</h1>
        <p>남은 인원 ${alive}명 · 이번 판 탈락 ${drop}명</p>
        ${g.implemented ? '' : '<div class="notice">아직 구현 전인 게임입니다. 임시로 무작위 순위가 정해집니다.</div>'}
        ${me().alive ? '' : '<p class="muted">탈락했으므로 관전만 합니다.</p>'}
      </div>
      <button class="btn" data-act="playGame">시작</button>
    `);
  }

  function playGame() {
    if (S.currentGame === 'memorypoker') runPoker();
    else if (S.currentGame === 'codebreak') runCode();
    else if (S.currentGame === 'heavy13') runHeavy();
    else if (S.currentGame === 'wallgo') runWall();
    else if (S.currentGame === 'gradation') startGradationRound();
    else if (S.currentGame === 'colorlink') startColorLinkRound();
    else runPlaceholder();
  }

  function runPlaceholder() {
    const g = Core.GAMES[S.currentGame];
    show(`
      <h2>${g.name} (임시)</h2>
      <div class="card-box center">
        <div class="big-emoji">🎲</div>
        <p>무작위로 순위를 정합니다.</p>
      </div>
      <button class="btn" data-act="placeholderDone">순위 정하기</button>
    `);
  }

  function placeholderDone() {
    const entries = Core.alivePlayers(S).map((p) => ({ id: p.id, key: [Math.floor(Math.random() * 1000)], tb: 0 }));
    finishRound(entries, null);
  }

  function finishRound(entries, extra) {
    stopTicker();
    const res = Core.resolveRound(S, entries);
    S.lastGame = S.currentGame;
    S.lastWinner = res.order[0].id;
    roundResult(res, extra);
  }

  function roundResult(res, extra) {
    const g = Core.GAMES[S.currentGame];
    const meOut = res.eliminated.includes('p0');
    const rows = res.order
      .map((o) => {
        const p = byId(o.id);
        const out = res.eliminated.includes(o.id);
        const detail = extra && extra.detail ? extra.detail(o.id) : '';
        return `<div class="row ${o.id === 'p0' ? 'me' : ''} ${out ? 'out' : ''}">
          <span class="rk">${o.rank}</span>
          <span class="nm">${esc(p.name)}</span>
          ${detail}
          ${out ? '<span class="badge-out">탈락</span>' : ''}
        </div>`;
      })
      .join('');
    show(`
      <div class="topbar"><span class="pill">${res.round} / ${S.totalRounds}판 결과</span><span class="pill">${g.name}</span></div>
      ${extra && extra.top ? extra.top : ''}
      ${meOut ? '<div class="notice">탈락했습니다. 남은 판은 관전합니다.</div>' : ''}
      <div class="card-box">
        <h3>순위</h3>
        <div class="list">${rows}</div>
        ${res.boundaryTie ? '<p class="muted">탈락선 동점 → 이전 판 성적(첫 판은 제출 시각)으로 결정했습니다.</p>' : ''}
      </div>
      ${S.practice
        ? `<button class="btn" data-act="practiceStart" data-v="${S.practice}">한 번 더</button><button class="btn secondary" data-act="practiceMenu">다른 게임 고르기</button><button class="btn secondary" data-act="home">홈으로</button>`
        : res.finished
        ? '<button class="btn" data-act="final">최종 순위 보기</button>'
        : '<button class="btn" data-act="next">다음 판</button>'}
    `);
  }

  // 게임 하나만 따로 연습 (탈락제 없이 한 판)
  function practiceMenu() {
    const list = Object.values(Core.GAMES)
      .filter((g) => g.implemented)
      .map((g) =>
        g.id === 'wallgo'
          ? `<button class="btn secondary" data-act="practiceStart" data-v="wallgo2">벽바둑 2인 (나 + AI 1)</button><button class="btn secondary" data-act="practiceStart" data-v="wallgo3">벽바둑 3인 (나 + AI 2)</button>`
          : `<button class="btn secondary" data-act="practiceStart" data-v="${g.id}">${g.name}</button>`
      )
      .join('');
    show(`
      <h2>게임 하나만 연습</h2>
      <p class="sub">나 + AI 3명과 한 판만 해 봅니다. (탈락 처리는 연습용)</p>
      <div class="card-box">${list}</div>
      <button class="btn secondary" data-act="home">돌아가기</button>
    `);
  }
  function practiceStart(id) {
    if (id === 'colorlink') {
      S = Core.createState(setup.name.trim() || '나', 2, 2);
      S.practice = id;
      S.currentGame = id;
      return clStart();
    }
    if (id === 'gradation') {
      S = Core.createState(setup.name.trim() || '나', 2, 2);
      S.practice = id;
      S.currentGame = id;
      return gradStart();
    }
    const wall = id === 'wallgo2' || id === 'wallgo3';
    S = Core.createState(setup.name.trim() || '나', wall ? +id.slice(-1) : 4, wall ? 2 : 3);
    S.practice = id;
    S.currentGame = wall ? 'wallgo' : id;
    playGame();
  }

  function finalScreen() {
    const st = Core.finalStandings(S);
    const medal = ['🥇', '🥈', '🥉'];
    const winner = st[0];
    const rows = st
      .map(
        (s) => `<div class="row ${s.id === 'p0' ? 'me' : ''}">
        <span class="rk">${medal[s.rank - 1] || s.rank}</span>
        <span class="nm">${esc(s.name)}</span>
        <span class="meta">${s.elimRound ? s.elimRound + '판 탈락' : '생존'}</span>
      </div>`
      )
      .join('');
    const myRank = st.find((s) => s.id === 'p0').rank;
    show(`
      <h1>최종 순위</h1>
      <div class="center"><div class="big-emoji">${myRank === 1 ? '🏆' : '🎮'}</div>
        <p class="sub">${winner.id === 'p0' ? '우승했습니다!' : esc(winner.name) + ' 우승 · 내 순위 ' + myRank + '위'}</p></div>
      <div class="card-box"><div class="list">${rows}</div></div>
      <button class="btn" data-act="setup">다시 하기</button>
      <button class="btn secondary" data-act="home">홈으로</button>
    `);
  }

  /* ---------- 기억포커 ---------- */
  function runPoker() {
    const dealt = Poker.deal();
    const alive = Core.alivePlayers(S);
    const meAlive = me().alive;
    const sub = {}; // id -> { picks, t }
    let myPicks = [];
    let phase = 'memorize';
    let deadline = Date.now() + 20000;
    let selStart = 0;
    const aiPlan = {}; // id -> { picks, at(ms) }

    const secLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const submittedCount = () => alive.filter((p) => sub[p.id]).length;
    const timerHtml = () => `<div class="timer ${secLeft() <= 5 ? 'low' : ''}" id="timer">${secLeft()}</div>`;
    const header = (t) =>
      `<div class="topbar"><span class="pill">${S.round + 1} / ${S.totalRounds}판</span><span class="pill">${t}</span>${meAlive ? '' : '<span class="pill warn">관전 중</span>'}</div>`;

    function renderMemorize() {
      $app.innerHTML = `
        ${header('기억포커 · 암기')}
        <p class="sub">카드 16장을 외우세요!</p>
        ${timerHtml()}
        <div class="grid4">${dealt.grid.map((c) => cardHtml(c)).join('')}</div>
        <button class="btn secondary" data-act="pkSkipMem">${meAlive ? '다 외웠어요' : '건너뛰기'}</button>`;
    }

    function renderSelect() {
      const cells = dealt.grid
        .map((_, i) => {
          const k = myPicks.indexOf(i);
          const locked = !meAlive || sub.p0;
          return `<button class="pcard back ${k >= 0 ? 'pick' : ''}" ${k >= 0 ? `data-n="${k + 1}"` : ''} data-act="pkPick" data-i="${i}" ${locked ? 'disabled' : ''}>.</button>`;
        })
        .join('');
      const status = alive
        .map((p) => `<span class="pill ${sub[p.id] ? 'ok' : ''}">${esc(p.name)} ${sub[p.id] ? '✓' : '…'}</span>`)
        .join('');
      let action;
      if (!meAlive) action = '<button class="btn secondary" data-act="pkSkipSel">결과로 건너뛰기</button>';
      else if (sub.p0) action = '<button class="btn secondary" disabled>제출 완료 · 다른 참가자 대기 중</button>';
      else action = `<button class="btn" data-act="pkSubmit" ${myPicks.length === 2 ? '' : 'disabled'}>선택 제출 (${myPicks.length}/2)</button>`;
      $app.innerHTML = `
        ${header('기억포커 · 선택')}
        <p class="sub">공유 카드 3장 + 내가 고른 2장으로 족보를 겨룹니다.</p>
        ${timerHtml()}
        <div class="shared">${dealt.shared.map((c) => cardHtml(c)).join('')}</div>
        <div class="grid4">${cells}</div>
        ${action}
        <div class="seg" style="gap:6px">${status}</div>`;
    }

    function toSelect() {
      phase = 'select';
      selStart = Date.now();
      deadline = selStart + 30000;
      alive.forEach((p) => {
        if (p.isAI) aiPlan[p.id] = { picks: Poker.aiChoose(dealt, p.memory), at: 3000 + Math.random() * 22000 };
      });
      renderSelect();
    }

    function submitMine() {
      if (sub.p0 || myPicks.length !== 2) return;
      sub.p0 = { picks: myPicks.slice(), t: (Date.now() - selStart) / 1000 };
      renderSelect();
    }

    function toReveal() {
      stopTicker();
      phase = 'reveal';
      const elapsed = (Date.now() - selStart) / 1000;
      const hands = {};
      const entries = alive.map((p) => {
        let s = sub[p.id];
        if (!s && p.id === 'p0' && myPicks.length === 1) {
          // 부분 제출은 무효 처리하고 무작위로 채움
          const rest = Poker.shuffle([...Array(16).keys()].filter((i) => i !== myPicks[0]));
          s = { picks: [myPicks[0], rest[0]], t: elapsed };
        }
        if (!s) return { id: p.id, key: [-1], tb: 999 };
        const h = Poker.handFor(dealt, s.picks);
        hands[p.id] = { picks: s.picks, hand: h };
        return { id: p.id, key: h.key, tb: s.t };
      });

      const myHit = hands.p0 ? hands.p0.picks : [];
      const top = `
        <div class="card-box">
          <h3>공유 카드</h3>
          <div class="shared">${dealt.shared.map((c) => cardHtml(c)).join('')}</div>
          <h3>정답 격자</h3>
          <div class="grid4">${dealt.grid.map((c, i) => cardHtml(c, myHit.includes(i) ? 'hit' : '')).join('')}</div>
        </div>`;
      const detail = (id) => {
        const h = hands[id];
        if (!h) return '<span class="meta">미제출</span>';
        return `<span class="cards">${h.picks.map((i) => cardHtml(dealt.grid[i], 'sm')).join('')}</span><span class="meta">${h.hand.name}</span>`;
      };
      finishRound(entries, { top, detail });
    }

    function tick() {
      const t = document.getElementById('timer');
      if (t) {
        t.textContent = secLeft();
        t.classList.toggle('low', secLeft() <= 5);
      }
      if (phase === 'memorize') {
        if (Date.now() >= deadline) toSelect();
      } else if (phase === 'select') {
        const el = Date.now() - selStart;
        let changed = false;
        alive.forEach((p) => {
          const a = aiPlan[p.id];
          if (a && !sub[p.id] && el >= a.at) {
            sub[p.id] = { picks: a.picks, t: a.at / 1000 };
            changed = true;
          }
        });
        if (alive.every((p) => sub[p.id]) || Date.now() >= deadline) return toReveal();
        if (changed) renderSelect();
      }
    }

    // 이 판에서만 쓰는 클릭 핸들러
    A.pkSkipMem = () => phase === 'memorize' && toSelect();
    A.pkPick = (el) => {
      if (phase !== 'select' || !meAlive || sub.p0) return;
      const i = +el.dataset.i;
      const k = myPicks.indexOf(i);
      if (k >= 0) myPicks.splice(k, 1);
      else if (myPicks.length < 2) myPicks.push(i);
      renderSelect();
    };
    A.pkSubmit = submitMine;
    A.pkSkipSel = () => {
      if (phase !== 'select') return;
      alive.forEach((p) => {
        const a = aiPlan[p.id];
        if (a && !sub[p.id]) sub[p.id] = { picks: a.picks, t: a.at / 1000 };
      });
      toReveal();
    };

    renderMemorize();
    window.scrollTo(0, 0);
    stopTicker();
    ticker = setInterval(tick, 250);
  }

  /* ---------- 비밀 코드 해독 ---------- */
  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  function chipHtml(c, cls, attrs) {
    return `<button class="chip c${c.color} ${cls || ''}" ${attrs || ''}><b>${c.letter}</b><i>${c.num}</i><span>${CODE_DECK.shapes[c.shape]}</span></button>`;
  }

  function runCode() {
    const deck = CODE_DECK.cards;
    const used = S.usedPuzzles || (S.usedPuzzles = []);
    let pool = CODE_PUZZLES.map((_, i) => i).filter((i) => !used.includes(i));
    if (!pool.length) { used.length = 0; pool = CODE_PUZZLES.map((_, i) => i); }
    const pz = CODE_PUZZLES[pool[Math.floor(Math.random() * pool.length)]];
    used.push(CODE_PUZZLES.indexOf(pz));

    // 확실한 조건 1개: 정답에 반드시 포함된 카드 (조건 목록 맨 위에 추가)
    const hintIdx = pz.answer.charCodeAt(Math.floor(Math.random() * 4)) - 65;
    const alive = Core.alivePlayers(S);
    const meAlive = me().alive;
    const st = {}; // id -> { solved, t, wrong, done }
    const plan = {};
    alive.forEach((p) => {
      st[p.id] = { solved: false, t: 0, wrong: 0, done: false };
      if (p.isAI) {
        const ok = Math.random() < 0.88;
        const r = Math.random();
        plan[p.id] = {
          at: 25 + (1 - p.memory) * 300 * Math.random() + Math.random() * 90, // 초
          ok,
          wrong: ok ? (r < 0.7 ? 0 : r < 0.95 ? 1 : 2) : 3,
        };
        plan[p.id].at = Math.min(plan[p.id].at, 172);
      }
    });
    const start = Date.now();
    const deadline = start + 180000;
    let picks = [];
    let msg = '';
    let ended = false;
    const xs = new Set(); // 내가 직접 ✕로 표시한(제외한) 카드
    let xMode = false;

    const secLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const elapsed = () => (Date.now() - start) / 1000;

    function render() {
      const mst = st.p0;
      const locked = !meAlive || mst.done;
      const chips = deck
        .map((c, i) => chipHtml(c, (picks.includes(i) ? 'sel' : '') + (xs.has(i) ? ' x' : ''), `data-act="cdPick" data-i="${i}" ${locked ? 'disabled' : ''}`))
        .join('');
      const pickText = picks.length ? picks.slice().sort((a, b) => a - b).map((i) => deck[i].letter).join(' ') : '카드 4장을 고르세요';
      const status = alive
        .map((p) => {
          const s = st[p.id];
          return `<span class="pill ${s.solved ? 'ok' : s.done ? 'warn' : ''}">${esc(p.name)} ${s.solved ? '✓' : s.done ? '✗' : '…'}</span>`;
        })
        .join('');
      let action;
      if (!meAlive) action = '<button class="btn secondary" data-act="cdSkip">결과로 건너뛰기</button>';
      else if (mst.solved) action = '<button class="btn secondary" disabled>정답! 다른 참가자 대기 중</button>';
      else if (mst.done) action = '<button class="btn secondary" disabled>오답 3회 · 제출 불가</button>';
      else
        action = `<div class="seg"><button class="${xMode ? '' : 'on'}" data-act="cdMode" data-v="pick">선택</button><button class="${xMode ? 'on' : ''}" data-act="cdMode" data-v="x">✕</button><button data-act="cdClear">선택 취소</button></div>
        <button class="btn" data-act="cdSubmit" ${picks.length === 4 ? '' : 'disabled'}>제출 (${picks.length}/4)</button>`;
      $app.innerHTML = `
        <div class="topbar"><span class="pill">${S.round + 1} / ${S.totalRounds}판</span><span class="pill">비밀 코드 해독</span>${meAlive ? `<span class="pill ${mst.wrong ? 'warn' : ''}">오답 ${mst.wrong}/3</span>` : '<span class="pill warn">관전 중</span>'}</div>
        <div class="timer ${secLeft() <= 15 ? 'low' : ''}" id="timer">${fmtTime(secLeft())}</div>
        <div class="card-box"><h3>조건을 모두 만족하는 카드 4장은?</h3>
          <ol class="conds"><li><b>${deck[hintIdx].letter} 카드가 포함된다</b></li>${pz.conds.map((t) => `<li>${t}</li>`).join('')}</ol></div>
        ${msg ? `<div class="notice">${msg}</div>` : ''}
        <div class="chips">${chips}</div>
        <div class="pickline">${pickText}</div>
        ${action}
        <div class="seg" style="gap:6px">${status}</div>`;
    }

    function end() {
      if (ended) return;
      ended = true;
      stopTicker();
      const entries = alive.map((p) => {
        const s = st[p.id];
        return { id: p.id, key: s.solved ? [2, -s.t] : [1, -s.wrong], tb: 0 };
      });
      const top = `<div class="card-box"><h3>정답</h3><div class="chips four">${pz.answer
        .split('')
        .map((l) => chipHtml(deck[l.charCodeAt(0) - 65], 'sel', 'disabled'))
        .join('')}</div></div>`;
      const detail = (id) => {
        const s = st[id];
        return `<span class="meta">${s.solved ? fmtTime(s.t) : '실패'}<br>오답 ${s.wrong}</span>`;
      };
      finishRound(entries, { top, detail });
    }

    function tick() {
      const t = document.getElementById('timer');
      if (t) {
        t.textContent = fmtTime(secLeft());
        t.classList.toggle('low', secLeft() <= 15);
      }
      let changed = false;
      const el = elapsed();
      alive.forEach((p) => {
        const a = plan[p.id];
        const s = st[p.id];
        if (a && !s.done && el >= a.at) {
          s.done = true;
          s.solved = a.ok;
          s.t = a.at;
          s.wrong = a.wrong;
          changed = true;
        }
      });
      if (alive.every((p) => st[p.id].done) || Date.now() >= deadline) return end();
      if (changed) render();
    }

    A.cdPick = (e) => {
      const i = +e.dataset.i;
      if (xMode) {
        // 제외 모드: ✕ 표시 토글 (선택돼 있던 카드는 선택 해제)
        if (xs.has(i)) xs.delete(i);
        else { xs.add(i); const p = picks.indexOf(i); if (p >= 0) picks.splice(p, 1); }
      } else {
        const k = picks.indexOf(i);
        xs.delete(i); // ✕였던 카드를 고르면 표시를 지움
        if (k >= 0) picks.splice(k, 1);
        else if (picks.length < 4) picks.push(i);
      }
      msg = '';
      render();
    };
    A.cdMode = (e) => { xMode = e.dataset.v === 'x'; render(); };
    A.cdClear = () => { picks = []; msg = ''; render(); };
    A.cdSubmit = () => {
      const s = st.p0;
      if (picks.length !== 4 || s.done) return;
      const guess = picks.slice().sort((a, b) => a - b).map((i) => deck[i].letter).join('');
      if (guess === pz.answer) {
        s.solved = true; s.done = true; s.t = elapsed();
      } else {
        s.wrong += 1;
        if (s.wrong >= 3) { s.done = true; msg = ''; } else msg = `오답입니다. 남은 기회 ${3 - s.wrong}회`;
      }
      picks = [];
      render();
    };
    A.cdSkip = () => {
      alive.forEach((p) => {
        const a = plan[p.id], s = st[p.id];
        if (a && !s.done) { s.done = true; s.solved = a.ok; s.t = a.at; s.wrong = a.wrong; }
      });
      end();
    };

    render();
    window.scrollTo(0, 0);
    stopTicker();
    ticker = setInterval(tick, 250);
  }

  /* ---------- 무거운 13 ---------- */
  function runHeavy() {
    const H = Heavy13;
    const alive = Core.alivePlayers(S);
    const meAlive = me().alive;
    const seatIds = Core.shuffle(alive.map((p) => p.id)); // 시계방향 좌석(무작위 고정)
    const hostId = meAlive ? 'p0' : seatIds[0];
    const lead = S.round === 0 ? hostId : seatIds.includes(S.lastWinner) ? S.lastWinner : seatIds[0];
    const G = H.create(seatIds, lead);
    let P = null;
    let phase = 'submit';
    let subs = {};
    let sel = { card: null, chip: null };
    let feed = [];
    let deadline = 0;
    let fast = false;

    const nm = (id) => esc(byId(id).name);
    const cname = (c) => H.NAME[c];
    const secLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const push = (t) => { feed.push(t); if (feed.length > 6) feed.shift(); };

    function pedsHtml() {
      return `<div class="peds">${H.COLORS.map((col) => {
        const sum = H.sumOf(G, col);
        return `<div class="ped ${col}"><b>${cname(col)}</b><span class="sum ${sum >= 10 ? 'hot' : ''}">${sum}<small>/13</small></span>
          <div class="cubes">${G.pedestals[col].map((v) => `<i>${v}</i>`).join('') || '<em>비어 있음</em>'}</div></div>`;
      }).join('')}</div>`;
    }
    function scoreHtml() {
      return `<div class="seg" style="gap:6px">${G.order
        .map((id) => `<span class="pill ${id === G.lead ? 'ok' : ''}">${id === G.lead ? '선 ' : ''}${nm(id)} ${G.penalty[id]}점</span>`)
        .join('')}</div>`;
    }
    const feedHtml = () => (feed.length ? `<div class="card-box feed">${feed.map((f) => `<p>${f}</p>`).join('')}</div>` : '');
    const head = () =>
      `<div class="topbar"><span class="pill">${S.round + 1} / ${S.totalRounds}판</span><span class="pill">무거운 13 · ${Math.min(G.round + 1, H.ROUNDS)}/${H.ROUNDS}R (세트 ${Math.floor(Math.min(G.round, H.ROUNDS - 1) / H.SET) + 1}/2)</span>${meAlive ? '' : '<span class="pill warn">관전 중</span>'}</div>`;
    const skipBtn = () => (!meAlive && !fast ? '<button class="btn secondary" data-act="hvFast">끝까지 건너뛰기</button>' : '');

    function renderSubmit() {
      const h = G.hands.p0;
      const cards = [0, 1, 2, 3, 4, 5, 6]
        .map((c) => `<button class="hcard ${sel.card === c ? 'sel' : ''}" data-act="hvCard" data-v="${c}" ${h.cards.includes(c) ? '' : 'disabled'}>${c}</button>`)
        .join('');
      const chips = ['red', 'green', 'blue', 'rainbow']
        .map((k) => `<button class="hchip ${k} ${sel.chip === k ? 'sel' : ''}" data-act="hvChip" data-v="${k}" ${h.chips[k] > 0 ? '' : 'disabled'}>${cname(k)} <small>×${h.chips[k]}</small></button>`)
        .join('');
      let hint = '카드와 칩을 하나씩 고르세요';
      if (sel.card !== null && sel.chip) {
        if (sel.chip === 'rainbow') hint = `레인보우 + 카드 ${sel.card}: 올릴 받침대는 차례에 직접 고릅니다`;
        else {
          const s = H.sumOf(G, sel.chip) + sel.card;
          hint = `${cname(sel.chip)} ${H.sumOf(G, sel.chip)} → ${s} ${s >= H.LIMIT ? '(다른 큐브가 없다면 폭발!)' : ''}`;
        }
      }
      $app.innerHTML = `${head()}
        <div class="timer ${secLeft() <= 10 ? 'low' : ''}" id="timer">${secLeft()}</div>
        ${pedsHtml()}${scoreHtml()}${feedHtml()}
        <div class="card-box"><h3>카드 (숫자만큼 큐브)</h3><div class="hcards">${cards}</div>
          <h3>칩 (올릴 받침대)</h3><div class="hchips">${chips}</div>
          <p class="muted center">${hint}</p></div>
        <button class="btn" data-act="hvSubmit" ${sel.card !== null && sel.chip ? '' : 'disabled'}>제출</button>`;
    }

    function renderPlace(cur) {
      const rows = P.order
        .map((id) => {
          const s = P.subs[id];
          const color = P.placedColor[id] || (s.chip === 'rainbow' ? 'rainbow' : s.chip);
          const st = P.done[id] ? '완료' : cur && cur.id === id ? '차례' : P.passed[id] ? '패스' : '대기';
          return `<div class="row ${id === 'p0' ? 'me' : ''} ${cur && cur.id === id ? 'turn' : ''} ${P.done[id] ? 'out' : ''}">
            <span class="nm">${nm(id)}</span><span class="dot ${color}"></span><span class="rk">${s.card}</span><span class="meta">${st}</span></div>`;
        })
        .join('');
      let action = '';
      if (cur && cur.id === 'p0') {
        const s = cur;
        const btns =
          s.chip === 'rainbow'
            ? H.COLORS.map((c) => `<button class="hchip ${c}" data-act="hvPlace" data-v="${c}">${cname(c)}에 올리기 <small>${H.sumOf(G, c)}→${H.sumOf(G, c) + s.card}</small></button>`).join('')
            : `<button class="hchip ${s.chip}" data-act="hvPlace" data-v="${s.chip}">${cname(s.chip)}에 올리기 <small>${H.sumOf(G, s.chip)}→${H.sumOf(G, s.chip) + s.card}</small></button>`;
        action = `<div class="card-box"><h3>내 차례 · 큐브 ${s.card}</h3><div class="hchips">${btns}</div>
          ${s.canPass ? '<button class="btn secondary" data-act="hvPass">패스 (뒤로 미루기, 라운드당 1회)</button>' : '<p class="muted center">패스는 이미 썼거나 불가합니다</p>'}</div>`;
      } else if (cur) action = `<p class="sub">${nm(cur.id)} 차례…</p>`;
      else action = '<p class="sub">라운드 종료</p>';
      $app.innerHTML = `${head()}
        <div class="timer ${secLeft() <= 5 ? 'low' : ''}" id="timer">${cur && cur.id === 'p0' ? secLeft() : '·'}</div>
        ${pedsHtml()}
        <div class="card-box"><h3>공개 · 올리는 순서</h3><div class="list">${rows}</div></div>
        ${action}${feedHtml()}${scoreHtml()}${skipBtn()}`;
    }

    function startRound() {
      H.startRound(G);
      subs = {};
      sel = { card: null, chip: null };
      alive.forEach((p) => { if (p.isAI) subs[p.id] = H.aiSubmit(G, p.id); });
      if (!meAlive) return beginPlace();
      phase = 'submit';
      deadline = Date.now() + 45000;
      renderSubmit();
    }
    function submitMine(auto) {
      if (phase !== 'submit') return;
      let { card, chip } = sel;
      if (!(card !== null && chip && H.validSubmit(G, 'p0', card, chip))) {
        // 시간 초과 등: 고른 것은 살리고 나머지는 무작위
        const o = H.options(G, 'p0');
        const m = o.filter((x) => (card === null || x.card === card) && (!chip || x.chip === chip));
        const pick = (m.length ? m : o)[Math.floor(Math.random() * (m.length ? m.length : o.length))];
        card = pick.card;
        chip = pick.chip;
      }
      subs.p0 = { card, chip };
      beginPlace();
    }
    function beginPlace() {
      P = H.beginPlacement(G, subs);
      phase = 'place';
      push(`<b>라운드 ${G.round + 1}</b> 공개 순서: ${P.order.map((id) => nm(id)).join(' → ')}`);
      step();
    }
    function apply(id, act) {
      if (act.type === 'pass') {
        H.pass(G, P, id);
        push(`${nm(id)} 패스`);
      } else {
        const ev = H.place(G, P, id, act.color);
        push(`${nm(id)}: ${cname(ev.color)}에 ${ev.value}${ev.exploded ? ` → <b class="boom">폭발! 큐브 ${ev.taken}개 가져가 벌점 +${ev.taken}</b>` : ` (합 ${ev.total})`}`);
      }
    }
    function step() {
      const cur = H.current(G, P);
      if (!cur) return endRoundH();
      if (byId(cur.id).isAI) {
        if (!fast) renderPlace(cur);
        stepTimer = setTimeout(() => {
          apply(cur.id, H.aiAct(G, P, cur.id));
          step();
        }, fast ? 0 : 800);
      } else {
        deadline = Date.now() + 20000;
        renderPlace(cur);
      }
    }
    function endRoundH() {
      H.endRound(G, P);
      if (H.finished(G)) return finish();
      if (!fast) renderPlace(null);
      stepTimer = setTimeout(startRound, fast ? 0 : 1500);
    }
    function finish() {
      stopTicker();
      const entries = alive.map((p) => ({ id: p.id, key: [-G.penalty[p.id], -G.lastPen[p.id]], tb: 0 }));
      const detail = (id) => `<span class="meta">벌점 ${G.penalty[id]}</span>`;
      finishRound(entries, { detail });
    }

    function tick() {
      const t = document.getElementById('timer');
      const cur = phase === 'place' && P ? H.current(G, P) : null;
      if (t && (phase === 'submit' || (cur && cur.id === 'p0'))) {
        t.textContent = secLeft();
        t.classList.toggle('low', secLeft() <= 10);
      }
      if (Date.now() < deadline) return;
      if (phase === 'submit' && meAlive && !subs.p0) submitMine(true);
      else if (cur && cur.id === 'p0') {
        apply('p0', H.aiAct(G, P, 'p0'));
        step();
      }
    }

    A.hvCard = (e) => { sel.card = +e.dataset.v; renderSubmit(); };
    A.hvChip = (e) => { sel.chip = e.dataset.v; renderSubmit(); };
    A.hvSubmit = () => submitMine(false);
    A.hvPlace = (e) => {
      const cur = H.current(G, P);
      if (!cur || cur.id !== 'p0') return;
      apply('p0', { type: 'place', color: e.dataset.v });
      step();
    };
    A.hvPass = () => {
      const cur = H.current(G, P);
      if (!cur || cur.id !== 'p0' || !cur.canPass) return;
      apply('p0', { type: 'pass' });
      step();
    };
    A.hvFast = () => { fast = true; };

    stopTicker();
    ticker = setInterval(tick, 250);
    startRound();
    window.scrollTo(0, 0);
  }

  /* ---------- 벽바둑 ---------- */
  function runWall() {
    const WG = Wallgo;
    const alive = Core.alivePlayers(S);
    const meAlive = me().alive;
    const G = WG.create(Core.shuffle(alive.map((p) => p.id)));
    const COLORS = ['#e5484d', '#4c8dff', '#e8b93c'];
    const colorOf = (pid) => COLORS[G.order.indexOf(pid)];
    const isAI = (pid) => byId(pid).isAI;
    const nm = (pid) => esc(byId(pid).name);
    const CELL = 44, PAD = 8, SIZE = WG.N * CELL + PAD * 2;

    let sub = 'select'; // 내 차례의 단계: select(말 선택/이동) → wall(벽 설치)
    let sel = null;
    let selMoves = [];
    let moved = null;
    let fast = false;
    let deadline = 0;
    let flash = null; // 방금 둔 수 표시: { piece, wall }
    let flashTimer = null;

    const secLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const myTurnPid =() => (G.phase === 'place' ? G.seq[G.seqIdx].pid : G.order[G.turn]);
    const isMyTurn = () => !G.over && meAlive && myTurnPid() === 'p0';

    function boardSvg(interactive) {
      const a = WG.analyze(G);
      const X = (c) => PAD + c * CELL, Y = (r) => PAD + r * CELL;
      let s = `<svg class="board" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">`;
      s += `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="10" fill="#1e212b"/>`;
      for (let r = 0; r < WG.N; r++) {
        for (let c = 0; c < WG.N; c++) {
          const reg = a.regions[a.cellRegion[r][c]];
          const owners = Object.keys(reg.counts);
          const tint = G.phase === 'play' && owners.length === 1 ? colorOf(owners[0]) : null;
          s += `<rect x="${X(c)}" y="${Y(r)}" width="${CELL}" height="${CELL}" fill="${tint || '#272b38'}" fill-opacity="${tint ? 0.3 : 1}" stroke="#14161c" stroke-width="1" ${interactive ? `data-act="wgCell" data-r="${r}" data-c="${c}"` : ''}/>`;
        }
      }
      // 이동 가능 칸
      if (interactive && sub === 'select' && sel) {
        selMoves.forEach((m) => {
          const cx = X(m.to[1]) + CELL / 2, cy = Y(m.to[0]) + CELL / 2;
          s += `<circle cx="${cx}" cy="${cy}" r="${m.broke ? 9 : 6}" fill="${m.broke ? 'none' : '#fff'}" stroke="#fff" stroke-width="${m.broke ? 3 : 0}" stroke-dasharray="${m.broke ? '3 3' : ''}" fill-opacity="0.85" pointer-events="none"/>`;
        });
      }
      // 방금 세운 벽 / 움직인 말: 옅은 빛 (2초)
      if (flash && flash.wall) {
        const k = flash.wall;
        const [r, c] = k.slice(1).split(',').map(Number);
        const [x1, y1, x2, y2] = k[0] === 'H' ? [X(c), Y(r + 1), X(c + 1), Y(r + 1)] : [X(c + 1), Y(r), X(c + 1), Y(r + 1)];
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffe9a8" stroke-width="16" stroke-linecap="round" stroke-opacity="0.4" pointer-events="none" class="glow"/>`;
      }
      if (flash && flash.piece) {
        s += `<circle cx="${X(flash.piece.c) + CELL / 2}" cy="${Y(flash.piece.r) + CELL / 2}" r="23" fill="#ffe9a8" fill-opacity="0.4" pointer-events="none" class="glow"/>`;
      }
      // 벽
      G.walls.forEach((k) => {
        const [t, rest] = [k[0], k.slice(1)];
        const [r, c] = rest.split(',').map(Number);
        if (t === 'H') s += `<line x1="${X(c)}" y1="${Y(r + 1)}" x2="${X(c + 1)}" y2="${Y(r + 1)}" stroke="#f5f5f0" stroke-width="6" stroke-linecap="round" pointer-events="none"/>`;
        else s += `<line x1="${X(c + 1)}" y1="${Y(r)}" x2="${X(c + 1)}" y2="${Y(r + 1)}" stroke="#f5f5f0" stroke-width="6" stroke-linecap="round" pointer-events="none"/>`;
      });
      // 말
      G.pieces.forEach((p) => {
        const cx = X(p.c) + CELL / 2, cy = Y(p.r) + CELL / 2;
        const on = (sel && sel === p) || (moved && moved === p);
        const stroke = on ? '#fff' : '#14161c';
        if (p.type === 'circle') s += `<circle cx="${cx}" cy="${cy}" r="14" fill="${colorOf(p.owner)}" stroke="${stroke}" stroke-width="${on ? 3 : 2}" pointer-events="none"/>`;
        else s += `<rect x="${cx - 13}" y="${cy - 13}" width="26" height="26" rx="3" fill="${colorOf(p.owner)}" stroke="${stroke}" stroke-width="${on ? 3 : 2}" pointer-events="none"/>`;
      });
      // 벽 설치 후보 면
      if (interactive && sub === 'wall' && moved) {
        WG.wallFaces(G, moved.r, moved.c).forEach((d) => {
          const r = moved.r, c = moved.c;
          let x1, y1, x2, y2;
          if (d === 0) { x1 = X(c); y1 = Y(r); x2 = X(c + 1); y2 = y1; }
          else if (d === 2) { x1 = X(c); y1 = Y(r + 1); x2 = X(c + 1); y2 = y1; }
          else if (d === 3) { x1 = X(c); y1 = Y(r); x2 = x1; y2 = Y(r + 1); }
          else { x1 = X(c + 1); y1 = Y(r); x2 = x1; y2 = Y(r + 1); }
          s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e8b93c" stroke-width="9" stroke-linecap="round" stroke-opacity="0.9" data-act="wgWall" data-d="${d}" style="cursor:pointer"/>`;
        });
      }
      s += '</svg>';
      return s;
    }

    function infoText() {
      if (G.over) return '게임 종료';
      const pid = myTurnPid();
      if (G.phase === 'place') {
        const t = G.seq[G.seqIdx].type === 'circle' ? '동그라미 ●' : '네모 ■';
        return pid === 'p0' && meAlive ? `내 말(${t})을 놓을 빈 칸을 누르세요` : `${nm(pid)}: ${t} 말을 놓는 중…`;
      }
      if (pid !== 'p0' || !meAlive) return `${nm(pid)} 차례…`;
      if (sub === 'wall') return '벽을 세울 면(노란 선)을 누르세요';
      if (!sel) return '움직일 내 말을 누르세요';
      return `이동할 칸을 누르세요${selMoves.some((m) => m.broke) ? ' (점선 원 = 벽 부수기)' : ''}`;
    }

    function render() {
      if (fast) return;
      const a = WG.analyze(G);
      const pills = G.order
        .map((id) => `<span class="pill" style="border-left:6px solid ${colorOf(id)}">${nm(id)} ${G.phase === 'play' ? a.scores[id].score + '칸' : ''}${G.order.length === 3 ? ` · 부수기 ${G.breaks[id]}` : ''}</span>`)
        .join('');
      const actor = G.over ? false : isMyTurn();
      $app.innerHTML = `
        <div class="topbar"><span class="pill">${S.round + 1} / ${S.totalRounds}판</span><span class="pill">벽바둑 ${G.order.length}인</span>${meAlive ? '' : '<span class="pill warn">관전 중</span>'}</div>
        <div class="timer ${secLeft() <= 15 ? 'low' : ''}" id="timer">${actor ? fmtTime(secLeft()) : '·'}</div>
        <p class="sub">${infoText()}</p>
        ${boardSvg(actor)}
        <div class="seg" style="gap:6px">${pills}</div>
        ${actor && sub === 'select' && sel ? '<button class="btn secondary" data-act="wgCancel">말 선택 취소</button>' : ''}
        ${!meAlive && !fast ? '<button class="btn secondary" data-act="wgFast">끝까지 건너뛰기</button>' : ''}
        <p class="muted center">● 동그라미: 1칸 또는 1칸+90° 꺾기 · ■ 네모: 직진 1~2칸<br>이동 후 그 말의 네 면 중 한 곳에 벽을 세웁니다.</p>`;
    }

    function showFlash(t) {
      const f = { piece: t.piece, wall: t.face === null ? null : WG.edgeKey(t.piece.r, t.piece.c, t.face) };
      flash = f;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (flash !== f || G.over) return;
        flash = null;
        render();
      }, 2000);
    }

    function advance() {
      if (G.over) return finish();
      const pid = myTurnPid();
      if (isAI(pid) || !meAlive || pid !== 'p0') {
        render();
        stepTimer = setTimeout(() => {
          if (G.phase === 'place') {
            const [r, c] = WG.aiPlace(G, pid);
            WG.place(G, r, c);
          } else {
            const t = WG.aiTurn(G, pid);
            WG.applyTurn(G, t);
            if (!fast) showFlash(t);
          }
          advance();
        }, fast ? 0 : G.phase === 'place' ? 700 : 1800);
      } else {
        sub = 'select';
        sel = null;
        selMoves = [];
        moved = null;
        deadline = Date.now() + 90000;
        render();
      }
    }

    function finishTurn() {
      sel = null; selMoves = []; moved = null; sub = 'select';
      WG.endTurn(G);
      advance();
    }

    function finish() {
      stopTicker();
      if (flashTimer) clearTimeout(flashTimer);
      flash = null;
      const a = WG.analyze(G);
      const entries = alive.map((p) => ({ id: p.id, key: [a.scores[p.id].score, a.scores[p.id].max], tb: 0 }));
      const top = `<div class="card-box"><h3>최종 보드</h3>${boardSvg(false)}${a.single ? '' : '<p class="muted">더 이상 움직일 수 없어 종료했습니다. (말이 섞인 구역은 점수 없음)</p>'}</div>`;
      const detail = (id) => `<span class="meta">${a.scores[id].score}칸<br>최대 ${a.scores[id].max}</span>`;
      finishRound(entries, { top, detail });
    }

    function tick() {
      const t = document.getElementById('timer');
      if (t && isMyTurn()) {
        t.textContent = fmtTime(secLeft());
        t.classList.toggle('low', secLeft() <= 15);
      }
      if (!isMyTurn() || Date.now() < deadline) return;
      // 시간 초과: 무작위 합법 수
      if (G.phase === 'place') {
        const cells = WG.emptyCells(G);
        const [r, c] = cells[Math.floor(Math.random() * cells.length)];
        WG.place(G, r, c);
        advance();
      } else if (sub === 'wall' && moved) {
        const f = WG.wallFaces(G, moved.r, moved.c);
        WG.applyWall(G, moved.r, moved.c, f[Math.floor(Math.random() * f.length)]);
        finishTurn();
      } else {
        const t2 = WG.randomTurn(G, 'p0');
        if (t2) WG.applyTurn(G, t2);
        else WG.endTurn(G);
        sel = null; selMoves = []; moved = null; sub = 'select';
        advance();
      }
    }

    A.wgCell = (el) => {
      if (!isMyTurn()) return;
      const r = +el.dataset.r, c = +el.dataset.c;
      if (G.phase === 'place') {
        if (WG.place(G, r, c)) advance();
        return;
      }
      if (sub !== 'select') return;
      const p = WG.pieceAt(G, r, c);
      if (p && p.owner === 'p0') {
        sel = p;
        selMoves = WG.moves(G, p);
        render();
        return;
      }
      const mv = sel && selMoves.find((m) => m.to[0] === r && m.to[1] === c);
      if (!mv) return;
      WG.applyMove(G, sel, mv);
      moved = sel;
      sel = null;
      selMoves = [];
      if (!WG.wallFaces(G, moved.r, moved.c).length) return finishTurn();
      sub = 'wall';
      render();
    };
    A.wgWall = (el) => {
      if (!isMyTurn() || sub !== 'wall' || !moved) return;
      WG.applyWall(G, moved.r, moved.c, +el.dataset.d);
      finishTurn();
    };
    A.wgCancel = () => { sel = null; selMoves = []; render(); };
    A.wgFast = () => { fast = true; };

    stopTicker();
    ticker = setInterval(tick, 250);
    advance();
    window.scrollTo(0, 0);
  }

  /* ---------- 그라데이션 ---------- */
  const gradCfg = { level: 'normal', mode: 'single' };
  const GRAD_LEVELS = [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']];

  function gradStart() {
    const seg = (items, cur, act) =>
      `<div class="seg">${items.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
    show(`
      <h2>그라데이션</h2>
      <div class="card-box rules">
        <p>숫자 큐브를 통에 숨기고 겨루는 1:1 심리전입니다.</p>
        <ul>
          <li>0~9 큐브(각 2개) 중 7개를 골라 7개 통에 <b>왼쪽→오른쪽 오름차순</b>으로 배치. 합계 30 이하, 제한 5분.</li>
          <li>통 색: 검정·진한 회색·밝은 회색·흰색·밝은 회색·진한 회색·검정. 가운데로 갈수록 중간 숫자예요.</li>
          <li>선공이 통 1개를 내면 후공은 <b>색만 보고</b> 자기 통을 냅니다. 큰 숫자가 1점, 같으면 0점.</li>
          <li>이긴 사람이 다음 선공. 7라운드 뒤 점수가 높은 쪽이 승리하고, 동점이면 다시 배치해 재대결합니다.</li>
        </ul>
      </div>
      <div class="card-box"><h3>AI 난이도</h3>${seg(GRAD_LEVELS, gradCfg.level, 'gdLevel')}
        <h3>게임 모드</h3>${seg([['single', '단판'], ['streak', '2연승']], gradCfg.mode, 'gdMode')}
        <p class="muted">2연승: 먼저 연속으로 두 판을 이기는 쪽이 최종 승리</p></div>
      <button class="btn" data-act="gdBegin">게임 시작</button>
      <button class="btn secondary" data-act="practiceMenu">돌아가기</button>
    `);
  }

  function startGradationRound() {
    const alive = Core.alivePlayers(S);
    const opp = alive.find((p) => p.id !== 'p0');
    if (!me().alive) return runGradation({ watch: true, ids: alive.map((p) => p.id) });
    // 탈락제에서는 단판, AI 난이도는 AI의 실력치로 결정
    const level = opp.memory < 0.78 ? 'easy' : opp.memory < 0.88 ? 'normal' : 'hard';
    runGradation({ practice: false, level, mode: 'single', oppId: opp.id });
  }

  function runGradation(cfg) {
    const GE = Gradation, AI = GradAI, V = GradView;

    // 관전(내가 탈락): AI끼리 바로 진행해 결과만 보여 줌
    if (cfg.watch) {
      for (;;) {
        const g = GE.create(AI.arrange('normal'), AI.arrange('normal'), Math.random() < 0.5 ? 'a' : 'b');
        while (!g.over) {
          const L = g.lead, F = GE.other(L);
          GE.lead(g, L, AI.choose('normal', GE.viewFor(g, L)));
          GE.follow(g, AI.choose('normal', GE.viewFor(g, F)));
        }
        const w = GE.winner(g);
        if (!w) continue;
        const [ida, idb] = cfg.ids;
        const entries = [
          { id: ida, key: [w === 'a' ? 1 : 0, g.score.a], tb: 0 },
          { id: idb, key: [w === 'b' ? 1 : 0, g.score.b], tb: 0 },
        ];
        return finishRound(entries, { detail: (id) => `<span class="meta">${id === ida ? g.score.a : g.score.b}점</span>` });
      }
    }

    const level = cfg.level;
    const oppName = esc(byId(cfg.oppId).name);
    const meName = esc(me().name);
    const streak = { a: 0, b: 0 };
    let G = null;
    let myArr = [];
    let selBin = null;
    let lock = false;
    let lastRec = null;
    let deadline = 0;

    const secLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const histHtml = () =>
      `<div class="card-box hist"><h3>라운드 기록</h3>${
        G.history.length
          ? G.history.map((h) => `<p>R${h.round} · ${meName} <b>${h.vals.a}</b> vs <b>${h.vals.b}</b> ${oppName} · ${h.winner === 'a' ? '내가 1점' : h.winner === 'b' ? 'AI 1점' : '무승부'}</p>`).join('')
          : '<p class="muted">아직 없음</p>'
      }</div>`;

    /* --- 숫자 배치 --- */
    function newGame() {
      myArr = [];
      selBin = null;
      lock = false;
      lastRec = null;
      deadline = Date.now() + 5 * 60 * 1000;
      renderArrange();
      stopTicker();
      ticker = setInterval(() => {
        const t = document.getElementById('timer');
        if (t) {
          t.textContent = fmtTime(secLeft());
          t.classList.toggle('low', secLeft() <= 30);
        }
        if (Date.now() >= deadline) finishArrange();
      }, 250);
    }

    function renderArrange() {
      const cnt = Array(10).fill(2);
      myArr.forEach((d) => cnt[d]--);
      const sum = myArr.reduce((s, x) => s + x, 0);
      const last = myArr.length ? myArr[myArr.length - 1] : 0;
      const err = myArr.length === 7 ? GE.validate(myArr) : null;
      const bins = [...Array(7)]
        .map((_, i) => V.bin({ level: GE.LEVEL[i], value: i < myArr.length ? myArr[i] : null, open: i < myArr.length }))
        .join('');
      const digits = [...Array(10).keys()]
        .map((d) => `<button data-act="gdDigit" data-v="${d}" ${cnt[d] === 0 || myArr.length >= 7 || d < last ? 'disabled' : ''}>${d}<small>×${cnt[d]}</small></button>`)
        .join('');
      $app.innerHTML = `
        <div class="topbar"><span class="pill">그라데이션 · ${GRAD_LEVELS.find((x) => x[0] === level)[1]}</span><span class="pill">숫자 배치</span></div>
        <div class="timer ${secLeft() <= 30 ? 'low' : ''}" id="timer">${fmtTime(secLeft())}</div>
        <div class="card-box"><div class="gbins">${bins}</div>
          <div class="gsum ${sum > 30 ? 'bad' : ''}">합계 ${sum} / 30</div>
          <p class="muted center">남은 큐브 ${20 - myArr.length}개 · 왼쪽→오른쪽 오름차순으로 놓아요${err ? `<br><b style="color:#ff6b6b">${err}</b>` : ''}</p></div>
        <div class="gnums">${digits}</div>
        <div class="seg"><button data-act="gdUndo">되돌리기</button><button data-act="gdReset">배치 초기화</button><button data-act="gdAuto">자동 배치</button></div>
        <button class="btn" data-act="gdDone" ${myArr.length === 7 && !err ? '' : 'disabled'}>배치 완료</button>`;
    }

    function finishArrange() {
      const arr = !GE.validate(myArr) ? myArr : GE.completePrefix(myArr) || GE.randomArrangement(); // 시간 초과: 유효한 조합으로 자동 완성
      startPlay(arr);
    }

    /* --- 대결 --- */
    function startPlay(arr) {
      stopTicker();
      myArr = arr.slice();
      G = GE.create(myArr, AI.arrange(level), Math.random() < 0.5 ? 'a' : 'b'); // 첫 선공은 무작위
      selBin = null;
      lastRec = null;
      step();
    }

    function remainingAiBins() {
      // 상대 통의 "위치"는 비공개이므로 색상별 남은 개수만으로 표시
      const left = [0, 0, 0, 0];
      GE.LEVEL.forEach((lv, i) => { if (!G.used.b[i]) left[lv]++; });
      const vis = [left[0] >= 1, left[1] >= 1, left[2] >= 1, left[3] >= 1, left[2] >= 2, left[1] >= 2, left[0] >= 2];
      return vis.map((v, i) => V.bin({ level: GE.LEVEL[i], used: !v })).join('');
    }

    function renderPlay(note) {
      let aiSlot, meSlot;
      if (lastRec) {
        const r = lastRec;
        aiSlot = `<div class="gslot">${V.bin({ level: GE.LEVEL[r.bins.b], value: r.vals.b, open: true, big: true, win: r.winner === 'b', lose: r.winner === 'a' })}<small>${oppName}</small></div>`;
        meSlot = `<div class="gslot">${V.bin({ level: GE.LEVEL[r.bins.a], value: r.vals.a, open: true, big: true, win: r.winner === 'a', lose: r.winner === 'b' })}<small>${meName}</small></div>`;
      } else {
        const p = G.pending;
        aiSlot = p && p.who === 'b' ? `<div class="gslot">${V.bin({ level: GE.LEVEL[p.bin], big: true })}<small>${oppName} 제출</small></div>` : V.emptySlot(oppName);
        meSlot = p && p.who === 'a' ? `<div class="gslot">${V.bin({ level: GE.LEVEL[p.bin], big: true })}<small>${meName} 제출</small></div>` : V.emptySlot(meName);
      }
      const mine = [...Array(7)]
        .map((_, i) =>
          V.bin({ tag: 'button', level: GE.LEVEL[i], value: myArr[i], open: true, used: G.used.a[i], selected: selBin === i, attrs: `data-act="gdBin" data-i="${i}" ${lock || G.used.a[i] ? 'disabled' : ''}` })
        )
        .join('');
      const roundShown = Math.min(G.round + (lastRec ? 0 : 1), 7);
      $app.innerHTML = `
        <div class="topbar"><span class="pill">라운드 ${roundShown}/7</span><span class="pill">${G.lead === 'a' ? '선공: 나' : '선공: ' + oppName}</span><span class="pill">${meName} ${G.score.a} : ${G.score.b} ${oppName}</span></div>
        <div class="card-box"><p class="muted center">${oppName}의 남은 통</p><div class="gbins">${remainingAiBins()}</div></div>
        <div class="duel">${aiSlot}${meSlot}</div>
        <p class="sub">${note || ''}</p>
        <div class="card-box"><p class="muted center">내 통 (숫자는 나만 보여요)</p><div class="gbins">${mine}</div></div>
        <button class="btn" data-act="gdSubmit" ${lock || selBin === null ? 'disabled' : ''}>선택한 통 제출</button>
        ${histHtml()}`;
    }

    function step() {
      if (G.over) return endGame();
      selBin = null;
      if (G.lead === 'b') {
        lock = true;
        renderPlay('AI가 통을 고르는 중…');
        stepTimer = setTimeout(() => {
          GE.lead(G, 'b', AI.choose(level, GE.viewFor(G, 'b')));
          lock = false;
          renderPlay('AI가 통을 냈어요. 색을 보고 내 통을 고르세요.');
        }, 1200);
      } else {
        lock = false;
        renderPlay('먼저 낼 통을 고르세요. 상대에게는 색만 보여요.');
      }
    }

    function reveal(rec) {
      lastRec = rec;
      lock = true;
      renderPlay(rec.winner === 'a' ? '내가 이겼어요! +1점' : rec.winner === 'b' ? 'AI가 이겼어요. +1점' : '무승부 – 점수 없음');
      stepTimer = setTimeout(() => {
        lastRec = null;
        step();
      }, 2600);
    }

    function submit() {
      if (lock || selBin === null || G.used.a[selBin]) return;
      lock = true;
      const bin = selBin;
      if (G.lead === 'a') {
        GE.lead(G, 'a', bin);
        selBin = null;
        renderPlay('AI가 통을 고르는 중…');
        stepTimer = setTimeout(() => reveal(GE.follow(G, AI.choose(level, GE.viewFor(G, 'b')))), 1200);
      } else {
        reveal(GE.follow(G, bin));
      }
    }

    /* --- 종료 --- */
    function endGame() {
      const w = GE.winner(G);
      if (w === null) {
        return show(`
          <h2>동점! 재대결</h2>
          <p class="sub">${G.score.a} : ${G.score.b} — 숫자를 다시 배치해 재대결합니다.</p>
          ${histHtml()}
          <button class="btn" data-act="gdRematch">다시 배치하기</button>`);
      }
      if (!cfg.practice) {
        const entries = [
          { id: 'p0', key: [w === 'a' ? 1 : 0, G.score.a], tb: 0 },
          { id: cfg.oppId, key: [w === 'b' ? 1 : 0, G.score.b], tb: 0 },
        ];
        return finishRound(entries, { top: histHtml(), detail: (id) => `<span class="meta">${id === 'p0' ? G.score.a : G.score.b}점</span>` });
      }
      streak[w] += 1;
      streak[GE.other(w)] = 0;
      const decided = cfg.mode === 'single' || streak[w] >= 2;
      const winText = w === 'a' ? '승리!' : '패배';
      show(`
        <h1>${decided ? (w === 'a' ? '최종 승리!' : '최종 패배') : `이번 판 ${winText}`}</h1>
        <p class="sub">${meName} ${G.score.a} : ${G.score.b} ${oppName}${cfg.mode === 'streak' ? ` · 연승 ${meName} ${streak.a} / ${oppName} ${streak.b}` : ''}</p>
        ${histHtml()}
        ${decided
          ? '<button class="btn" data-act="practiceStart" data-v="gradation">다시 플레이하기</button><button class="btn secondary" data-act="home">메인 화면으로</button>'
          : '<button class="btn" data-act="gdRematch">다음 판 (2연승 모드)</button>'}`);
    }

    A.gdDigit = (e) => {
      const d = +e.dataset.v;
      const cnt = myArr.filter((x) => x === d).length;
      if (myArr.length >= 7 || cnt >= 2 || (myArr.length && d < myArr[myArr.length - 1])) return;
      myArr.push(d);
      renderArrange();
    };
    A.gdUndo = () => { myArr.pop(); renderArrange(); };
    A.gdReset = () => { myArr = []; renderArrange(); };
    A.gdAuto = () => { myArr = GE.randomArrangement(); renderArrange(); };
    A.gdDone = () => { if (!GE.validate(myArr)) finishArrange(); };
    A.gdBin = (e) => {
      if (lock) return;
      const i = +e.dataset.i;
      if (G.used.a[i]) return;
      selBin = i;
      renderPlay(G.lead === 'a' ? '이 통을 제출할까요?' : renderNote());
    };
    const renderNote = () => 'AI가 낸 통의 색을 보고 내 통을 고르세요.';
    A.gdSubmit = submit;
    A.gdRematch = newGame;

    newGame();
    window.scrollTo(0, 0);
  }

  /* ---------- 컬러 링크 ---------- */
  const clCfg = { level: 'normal', map: 'random', mode: 'single' };
  const CL_COLORS = ['#e5484d', '#f76b15', '#f5d90a', '#99d52a', '#30a46c', '#12a594', '#05a2c2', '#3e63dd', '#6e56cf', '#ab4aba', '#d6409f', '#a18072', '#8b8d98', '#eeeeee'];
  const CL_DARK_TEXT = [2, 3, 13, 12]; // 밝은 색은 어두운 글자

  function clStart() {
    const seg = (items, cur, act) =>
      `<div class="seg">${items.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const C = ColorLink.CFG;
    show(`
      <h2>컬러 링크</h2>
      <div class="card-box rules">
        <p>같은 색 말끼리 이을 수 있는 판인지 겨루는 1:1 전략 대결입니다.</p>
        <ul>
          <li>A~N 14가지 색, 색마다 말 2개를 두 사람이 함께 씁니다. 선공은 1개, 이후 매 차례 <b>서로 다른 색 2개</b>를 빈칸에 놓아요. (${C.PLACE_SEC}초)</li>
          <li>모든 색을 상하좌우로 <b>${C.MIN_LEN}칸 이상</b> 경로로 이을 수 있어야 하고, 경로끼리는 겹치거나 교차하면 안 돼요.</li>
          <li>연결이 불가능해지는 배치도 놓을 수 있어요. 상대가 만든 판이 불가능하다고 생각하면 <b>불가능 선언</b>!</li>
          <li>선언하면 직전에 놓은 사람이 ${C.PROOF_SEC}초 안에 모든 경로를 그려 증명해요. 증명하면 증명자 승, 못하면 선언한 사람 승.</li>
          <li>하나만 놓인 색은 짝이 놓일 빈칸(가상의 짝)까지 ${C.MIN_LEN}칸 이상 경로를 만들어야 해요.</li>
        </ul>
      </div>
      <div class="card-box"><h3>AI 난이도</h3>${seg(GRAD_LEVELS, clCfg.level, 'clLevel')}
        <h3>판</h3>${seg([['random', '랜덤']].concat(ColorLink.MAPS.map((m) => [m.id, `${m.name}`])), clCfg.map, 'clMap')}
        <p class="muted">${clCfg.map === 'random' ? '매 라운드 무작위 판' : ColorLink.MAPS.find((m) => m.id === clCfg.map).name + ' · ' + ColorLink.MAPS.find((m) => m.id === clCfg.map).level}</p>
        <h3>게임 모드</h3>${seg([['single', '단판'], ['first3', '3점 선취']], clCfg.mode, 'clMode')}</div>
      <button class="btn" data-act="clBegin">게임 시작</button>
      <button class="btn secondary" data-act="practiceMenu">돌아가기</button>
    `);
  }

  function startColorLinkRound() {
    const alive = Core.alivePlayers(S);
    const opp = alive.find((p) => p.id !== 'p0');
    const level = opp && opp.memory < 0.78 ? 'easy' : opp && opp.memory < 0.88 ? 'normal' : 'hard';
    if (!me().alive) return runColorLink({ watch: true, ids: alive.map((p) => p.id), level: 'normal' });
    runColorLink({ practice: false, level, map: 'random', mode: 'single', oppId: opp.id });
  }

  function runColorLink(cfg) {
    const CLN = ColorLink, AIc = ColorLinkAI, CFG = CLN.CFG;
    const level = cfg.level;

    // 관전(내가 탈락): AI끼리 진행 후 결과만 표시
    if (cfg.watch) {
      show(`<h2>컬러 링크</h2><div class="card-box center"><div class="big-emoji">⏳</div><p>AI끼리 대결하는 중…</p></div>`);
      const mine = [];
      const t = Core.shuffle(cfg.ids);
      const simRound = (done) => {
        const S2 = CLN.newState(CLN.makeBoard(CLN.MAPS[Math.floor(Math.random() * CLN.MAPS.length)].id));
        let turn = Math.random() < 0.5 ? 0 : 1, moves = 0, last = null;
        const declare = (who) => AIc.prove(S2, 'normal', (paths) => done(paths && CLN.validateProof(S2, paths).ok ? last : who));
        const step = () => {
          const need = moves === 0 ? 1 : 2;
          if (!CLN.canPlace(S2, need)) return declare(turn);
          const go = () => AIc.chooseTurn(S2, need, 'normal', (pl) => { CLN.applyPlacement(S2, pl); moves++; last = turn; turn = 1 - turn; step(); });
          if (moves > 0) AIc.shouldDeclare(S2, 'normal', (d) => (d ? declare(turn) : go()));
          else go();
        };
        step();
      };
      const sc = [0, 0];
      (function loop() {
        simRound((w) => {
          sc[w]++;
          if (sc[0] === 0 && sc[1] === 0) return loop();
          const entries = t.map((id, k) => ({ id, key: [sc[k] > sc[1 - k] ? 1 : 0, sc[k]], tb: 0 }));
          finishRound(entries, { detail: (id) => `<span class="meta">${sc[t.indexOf(id)]}점</span>` });
        });
      })();
      return mine;
    }

    const oppName = esc(byId(cfg.oppId).name);
    const meName = esc(me().name);
    const sc = { me: 0, ai: 0 };
    const history = [];
    const stats = { meOk: 0, meFail: 0, aiOk: 0, aiFail: 0 };
    let roundNo = 0, board = null, St = null;
    let turn = 'me', moves = 0, last = null, declarer = null;
    let pending = [], selColor = null, msg = '';
    let phase = 'place';
    let deadline = 0, token = 0;
    let flash = [];
    let flashSeq = 0;
    let proof = { paths: {}, sel: null };
    let resultInfo = null;
    let dragging = false, dragLast = -1;

    const other = (w) => (w === 'me' ? 'ai' : 'me');
    const secLeft = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const needNow = () => (moves === 0 ? 1 : 2);
    const nameOf = (w) => (w === 'me' ? meName : oppName);
    const pickMap = () => (cfg.map && cfg.map !== 'random' ? cfg.map : CLN.MAPS[Math.floor(Math.random() * CLN.MAPS.length)].id);

    /* ---------- 그리기 ---------- */
    function boardSvg(mode, paths) {
      const B = board;
      const CELL = Math.min(44, Math.floor(330 / Math.max(B.R, B.C))), PADD = 8;
      const W = B.C * CELL + PADD * 2, H = B.R * CELL + PADD * 2;
      const X = (i) => PADD + (i % B.C) * CELL + CELL / 2, Y = (i) => PADD + Math.floor(i / B.C) * CELL + CELL / 2;
      let s = `<svg class="board" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" rx="10" fill="#1e212b"/>`;
      for (let i = 0; i < B.N; i++) {
        if (!B.mask[i]) continue;
        const attr = mode === 'place' ? `data-act="clCell" data-i="${i}"` : mode === 'proof' ? `data-cl-proof data-i="${i}"` : '';
        s += `<rect x="${PADD + (i % B.C) * CELL}" y="${PADD + Math.floor(i / B.C) * CELL}" width="${CELL}" height="${CELL}" fill="#272b38" stroke="#14161c" ${attr}/>`;
      }
      // 경로 (코드로 실시간 생성)
      if (paths) {
        const pcs = CLN.piecesOf(St);
        Object.keys(paths).forEach((c) => {
          const p = paths[c];
          if (!p || p.length < 2) return;
          const pts = p.map((i) => `${X(i)},${Y(i)}`).join(' ');
          s += `<polyline points="${pts}" fill="none" stroke="${CL_COLORS[c]}" stroke-width="${CELL * 0.3}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.85" pointer-events="none"/>`;
          if (mode === 'result') s += `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="clflow" pointer-events="none"/>`;
          const end = p[p.length - 1];
          if (pcs[c].length === 1 && p.length > 1 && St.cells[end] === -1) s += `<circle cx="${X(end)}" cy="${Y(end)}" r="${CELL * 0.3}" fill="none" stroke="${CL_COLORS[c]}" stroke-width="3" stroke-dasharray="4 3" pointer-events="none"/><text x="${X(end)}" y="${Y(end) + 4}" text-anchor="middle" font-size="${CELL * 0.3}" font-weight="800" fill="${CL_COLORS[c]}" pointer-events="none">${CLN.LETTERS[c]}</text>`;
        });
      }
      // 말
      for (let i = 0; i < B.N; i++) {
        const c = St.cells[i];
        if (c < 0) continue;
        const ring = flash.includes(i) ? `<circle cx="${X(i)}" cy="${Y(i)}" r="${CELL * 0.46}" fill="none" stroke="#fff" stroke-width="3" class="clpulse" pointer-events="none"/>` : '';
        s += `${ring}<circle cx="${X(i)}" cy="${Y(i)}" r="${CELL * 0.36}" fill="${CL_COLORS[c]}" stroke="#14161c" stroke-width="2" pointer-events="none"/><text x="${X(i)}" y="${Y(i) + CELL * 0.12}" text-anchor="middle" font-size="${CELL * 0.36}" font-weight="800" fill="${CL_DARK_TEXT.includes(c) ? '#14161c' : '#fff'}" pointer-events="none">${CLN.LETTERS[c]}</text>`;
      }
      // 배치 대기 중인 말 (아직 확정 전)
      pending.forEach((p) => {
        s += `<circle cx="${X(p.cell)}" cy="${Y(p.cell)}" r="${CELL * 0.36}" fill="${CL_COLORS[p.color]}" fill-opacity="0.75" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 3" pointer-events="none"/><text x="${X(p.cell)}" y="${Y(p.cell) + CELL * 0.12}" text-anchor="middle" font-size="${CELL * 0.36}" font-weight="800" fill="${CL_DARK_TEXT.includes(p.color) ? '#14161c' : '#fff'}" pointer-events="none">${CLN.LETTERS[p.color]}</text>`;
      });
      // 증명 중 선택한 색의 마지막 칸 강조
      if (mode === 'proof' && proof.sel !== null) {
        const p = proof.paths[proof.sel];
        if (p && p.length) s += `<circle cx="${X(p[p.length - 1])}" cy="${Y(p[p.length - 1])}" r="${CELL * 0.14}" fill="#fff" pointer-events="none"/>`;
      }
      return s + '</svg>';
    }

    const scoreBar = () =>
      `<div class="topbar"><span class="pill">라운드 ${roundNo}</span><span class="pill">${meName} ${sc.me} : ${sc.ai} ${oppName}</span><span class="pill ${phase === 'place' ? 'ok' : ''}">${board ? board.name : ''}</span></div>`;

    function palette(selectable) {
      return `<div class="clpal">${CLN.LETTERS.split('')
        .map((L, c) => {
          const left = CLN.CFG.PER_COLOR - St.counts[c] - pending.filter((p) => p.color === c).length;
          const dis = !selectable || left <= 0;
          return `<button class="clchip ${selColor === c ? 'sel' : ''}" style="background:${CL_COLORS[c]};color:${CL_DARK_TEXT.includes(c) ? '#14161c' : '#fff'}" data-act="clColor" data-v="${c}" ${dis ? 'disabled' : ''}>${L}<small>×${Math.max(0, left)}</small></button>`;
        })
        .join('')}</div>`;
    }

    function render() {
      if (phase === 'place') {
        const mineTurn = turn === 'me';
        const need = needNow();
        $app.innerHTML = `${scoreBar()}
          <div class="timer ${secLeft() <= 10 ? 'low' : ''}" id="timer">${mineTurn ? secLeft() : '·'}</div>
          <p class="sub">${mineTurn ? `서로 다른 색 <b>${need}개</b>를 빈칸에 놓으세요 (${pending.length}/${need})` : `${oppName} 생각 중…`}</p>
          ${msg ? `<div class="notice">${msg}</div>` : ''}
          ${boardSvg(mineTurn ? 'place' : null)}
          ${palette(mineTurn)}
          <div class="seg"><button data-act="clUndo" ${mineTurn && pending.length ? '' : 'disabled'}>배치 취소</button></div>
          <button class="btn" data-act="clConfirm" ${mineTurn && pending.length === need ? '' : 'disabled'}>배치 확정</button>
          <button class="btn danger" data-act="clDecl" ${mineTurn && moves > 0 ? '' : 'disabled'}>불가능 선언!</button>
          <p class="muted center">연결이 불가능해 보이면 말을 놓는 대신 선언하세요. 선언하면 상대가 ${CFG.PROOF_SEC}초 안에 증명해야 해요.</p>`;
      } else if (phase === 'proof') {
        const pres = CLN.piecesOf(St).map((p, c) => (p.length ? c : -1)).filter((c) => c >= 0);
        const complete = (c) => proofComplete(c);
        const doneN = pres.filter(complete).length;
        const chips = pres
          .map((c) => {
            const p = proof.paths[c] || [];
            return `<button class="clchip ${proof.sel === c ? 'sel' : ''}" style="background:${CL_COLORS[c]};color:${CL_DARK_TEXT.includes(c) ? '#14161c' : '#fff'}" data-act="clProofColor" data-v="${c}">${CLN.LETTERS[c]}<small>${complete(c) ? '✓ ' : ''}${p.length}칸</small></button>`;
          })
          .join('');
        $app.innerHTML = `${scoreBar()}
          <div class="clwarn">${nameOf(declarer)}: 불가능 선언!</div>
          <div class="timer ${secLeft() <= 15 ? 'low' : ''}" id="timer">${fmtTime(secLeft())}</div>
          <p class="sub">모든 색을 이어 증명하세요 · 연결 완료 ${doneN}/${pres.length}</p>
          ${msg ? `<div class="notice">${msg}</div>` : ''}
          ${boardSvg('proof', proof.paths)}
          <div class="clpal">${chips}</div>
          <p class="muted center">말을 누르고 이웃 칸을 차례로 누르세요(마우스는 드래그). 마지막 칸을 누르면 한 칸 되돌려요. 말이 하나뿐인 색은 ${CFG.MIN_LEN}칸 이상 이으면 끝칸이 가상의 짝이에요.</p>
          <div class="seg"><button data-act="clProofDel" ${proof.sel !== null ? '' : 'disabled'}>선택한 경로 삭제</button><button data-act="clProofReset">전체 초기화</button></div>
          <button class="btn" data-act="clProofDone" ${doneN === pres.length && pres.length ? '' : 'disabled'}>증명 완료</button>`;
      } else if (phase === 'aiProving') {
        $app.innerHTML = `${scoreBar()}
          <div class="clwarn">${nameOf(declarer)}: 불가능 선언!</div>
          <p class="sub">${oppName}: 연결 경로를 찾는 중…</p>
          ${boardSvg(null)}`;
      } else if (phase === 'result') {
        const r = resultInfo;
        const decided = cfg.mode === 'single' || sc[r.winner] >= CFG.WIN_SCORE;
        const loser = other(r.winner);
        let nextHtml;
        if (decided) nextHtml = `<button class="btn" data-act="clEnd">결과 보기</button>`;
        else if (loser === 'me') nextHtml = `<p class="sub">내가 졌으니 다음 라운드 순서를 고를 수 있어요</p><div class="seg"><button data-act="clNext" data-v="me">선공으로 시작</button><button data-act="clNext" data-v="ai">후공으로 시작</button></div>`;
        else nextHtml = `<p class="sub">${oppName}: 순서 선택 완료</p><button class="btn" data-act="clNext" data-v="${Math.random() < 0.5 ? 'ai' : 'me'}">다음 라운드</button>`;
        $app.innerHTML = `${scoreBar()}
          <h2 class="center ${r.winner === 'me' ? '' : 'boom'}">${r.winner === 'me' ? '라운드 승리!' : '라운드 패배'}</h2>
          <p class="sub">${r.reason}</p>
          ${boardSvg('result', r.paths)}
          ${nextHtml}`;
      }
    }

    function startTick() {
      stopTicker();
      ticker = setInterval(() => {
        const t = document.getElementById('timer');
        if (t) {
          t.textContent = phase === 'proof' ? fmtTime(secLeft()) : secLeft();
          t.classList.toggle('low', secLeft() <= (phase === 'proof' ? 15 : 10));
        }
        if (Date.now() < deadline) return;
        if (phase === 'place' && turn === 'me') roundEnd('ai', `${meName}: 배치 시간 초과`);
        else if (phase === 'proof') finishProof(false, null, '증명 시간이 지났어요');
      }, 250);
    }

    /* ---------- 라운드 진행 ---------- */
    function startRound(first) {
      roundNo++;
      board = CLN.makeBoard(pickMap());
      St = CLN.newState(board);
      moves = 0; last = null; declarer = null;
      pending = []; selColor = null; msg = ''; flash = [];
      proof = { paths: {}, sel: null };
      turn = first;
      phase = 'place';
      beginTurn();
    }

    function beginTurn() {
      const my = ++token;
      msg = '';
      pending = [];
      selColor = null;
      const need = needNow();
      if (!CLN.canPlace(St, need)) return declare(turn); // 더 놓을 수 없으면 불가능 선언으로 처리
      phase = 'place';
      if (turn === 'me') {
        deadline = Date.now() + CFG.PLACE_SEC * 1000;
        render();
        startTick();
      } else {
        stopTicker();
        render();
        const place = () =>
          AIc.chooseTurn(St, need, level, (pl) => {
            if (my !== token) return;
            CLN.applyPlacement(St, pl);
            flash = pl.map((p) => p.cell); // 방금 놓은 말을 잠깐 강조
            const ft = ++flashSeq;
            setTimeout(() => { if (flashSeq === ft && flash.length) { flash = []; render(); } }, 2000);
            moves++; last = 'ai'; turn = 'me';
            render();
            stepTimer = setTimeout(() => { if (my === token) beginTurn(); }, 400);
          });
        stepTimer = setTimeout(() => {
          if (my !== token) return;
          if (moves > 0) AIc.shouldDeclare(St, level, (d) => { if (my !== token) return; d ? declare('ai') : place(); });
          else place();
        }, 700);
      }
    }

    function declare(who) {
      token++;
      stopTicker();
      declarer = who;
      const prover = last;
      msg = '';
      if (prover === 'me') {
        phase = 'proof';
        proof = { paths: {}, sel: null };
        deadline = Date.now() + CFG.PROOF_SEC * 1000;
        render();
        startTick();
      } else {
        phase = 'aiProving';
        render();
        const my = token;
        const t0 = Date.now();
        AIc.prove(St, level, (paths) => {
          const ok = paths ? CLN.validateProof(St, paths).ok : false;
          setTimeout(() => { if (my === token) finishProof(ok, paths, ok ? null : `${oppName}: 연결 증명 실패`); }, Math.max(0, 1500 - (Date.now() - t0)));
        });
      }
    }

    function finishProof(ok, paths, why) {
      token++;
      stopTicker();
      const prover = last;
      const winner = ok ? prover : declarer;
      if (declarer === 'me') (ok ? stats.meFail++ : stats.meOk++);
      else (ok ? stats.aiFail++ : stats.aiOk++);
      const reason = ok ? `${nameOf(prover)}: 연결 증명 성공 — ${nameOf(declarer)}의 불가능 선언 실패` : `${why || '증명 실패'} — ${nameOf(declarer)}의 불가능 선언 성공`;
      roundEnd(winner, reason, ok ? paths : null, true);
    }

    function roundEnd(winner, reason, paths, byDecl) {
      token++;
      stopTicker();
      sc[winner]++;
      history.push({ n: roundNo, winner, reason, map: board.name, decl: !!byDecl });
      resultInfo = { winner, reason, paths: paths || null };
      phase = 'result';
      render();
    }

    /* ---------- 증명(경로 그리기) ---------- */
    function proofComplete(c) {
      const p = proof.paths[c];
      if (!p || p.length < CFG.MIN_LEN) return false;
      const pieces = CLN.piecesOf(St)[c];
      if (pieces.length === 2) return p.length >= CFG.MIN_LEN && St.cells[p[p.length - 1]] === c && p[p.length - 1] !== p[0];
      return true;
    }
    function proofTap(i, fromDrag) {
      msg = '';
      const c0 = St.cells[i];
      let sel = proof.sel;
      if (c0 >= 0 && c0 !== sel) {
        proof.sel = c0;
        if (!(proof.paths[c0] && proof.paths[c0].length)) proof.paths[c0] = [i];
        return render();
      }
      if (sel === null) { msg = '먼저 색을 고르거나 말을 누르세요'; return render(); }
      let path = proof.paths[sel] || [];
      if (!path.length) {
        if (c0 === sel) proof.paths[sel] = [i];
        else msg = '이 색의 말에서 시작하세요';
        return render();
      }
      const idx = path.indexOf(i);
      if (idx >= 0) {
        if (fromDrag) return;
        if (idx === path.length - 1) path = path.slice(0, -1);
        else path = path.slice(0, idx + 1);
        proof.paths[sel] = path;
        return render();
      }
      const lastCell = path[path.length - 1];
      if (!board.adj[lastCell].includes(i)) { if (!fromDrag) { msg = '바로 옆 칸으로만 이을 수 있어요'; render(); } return; }
      if (path.length > 1 && St.cells[lastCell] === sel) { msg = '이미 연결됐어요. 마지막 칸을 눌러 되돌리세요'; return render(); }
      for (const k of Object.keys(proof.paths)) {
        if (+k !== sel && proof.paths[k].includes(i)) { msg = `${CLN.LETTERS[+k]} 경로와 겹쳐요`; return render(); }
      }
      proof.paths[sel] = path.concat(i);
      render();
    }

    function proofDone() {
      const v = CLN.validateProof(St, proof.paths);
      if (!v.ok) { msg = v.errors.slice(0, 3).join(' / '); return render(); }
      finishProof(true, proof.paths);
    }

    /* ---------- 종료 ---------- */
    function endGame() {
      token++;
      stopTicker();
      const w = sc.me > sc.ai ? 'me' : 'ai';
      if (!cfg.practice) {
        const entries = [
          { id: 'p0', key: [w === 'me' ? 1 : 0, sc.me], tb: 0 },
          { id: cfg.oppId, key: [w === 'ai' ? 1 : 0, sc.ai], tb: 0 },
        ];
        return finishRound(entries, { detail: (id) => `<span class="meta">${id === 'p0' ? sc.me : sc.ai}점</span>` });
      }
      show(`
        <h1>${w === 'me' ? '최종 승리!' : '최종 패배'}</h1>
        <p class="sub">${meName} ${sc.me} : ${sc.ai} ${oppName}</p>
        <div class="card-box hist"><h3>라운드 기록</h3>${history.map((h) => `<p>R${h.n} · ${h.map} · ${h.winner === 'me' ? '승' : '패'} — ${h.reason}</p>`).join('')}</div>
        <div class="card-box hist"><h3>불가능 선언 기록</h3>
          <p>내 선언: 성공 ${stats.meOk} · 실패 ${stats.meFail}</p><p>${oppName} 선언: 성공 ${stats.aiOk} · 실패 ${stats.aiFail}</p></div>
        <button class="btn" data-act="practiceStart" data-v="colorlink">다시 플레이하기</button>
        <button class="btn secondary" data-act="home">메인 화면으로</button>`);
    }

    /* ---------- 입력 ---------- */
    A.clColor = (e) => {
      if (phase !== 'place' || turn !== 'me') return;
      selColor = +e.dataset.v;
      msg = '';
      render();
    };
    A.clCell = (e) => {
      if (phase !== 'place' || turn !== 'me') return;
      const i = +e.dataset.i;
      msg = '';
      const k = pending.findIndex((p) => p.cell === i);
      if (k >= 0) { pending.splice(k, 1); return render(); }
      if (St.cells[i] !== -1) { msg = '이미 말이 있는 칸이에요'; return render(); }
      if (selColor === null) { msg = '먼저 아래에서 색을 고르세요'; return render(); }
      const same = pending.findIndex((p) => p.color === selColor);
      if (same >= 0) pending.splice(same, 1); // 같은 색을 다시 고르면 위치만 옮김(같은 차례 같은 색 2개는 불가)
      if (pending.length >= needNow()) { msg = `이번 차례에는 ${needNow()}개만 놓아요`; return render(); }
      pending.push({ cell: i, color: selColor });
      selColor = null;
      render();
    };
    A.clUndo = () => { if (phase === 'place' && turn === 'me') { pending = []; selColor = null; msg = ''; render(); } };
    A.clConfirm = () => {
      if (phase !== 'place' || turn !== 'me') return;
      const err = CLN.checkPlacement(St, pending, needNow());
      if (err) { msg = err; return render(); }
      token++;
      stopTicker();
      CLN.applyPlacement(St, pending);
      flash = [];
      moves++; last = 'me'; turn = 'ai';
      beginTurn();
    };
    A.clDecl = () => {
      if (phase !== 'place' || turn !== 'me' || moves === 0) return;
      declare('me');
    };
    A.clProofColor = (e) => {
      if (phase !== 'proof') return;
      proof.sel = +e.dataset.v;
      const pieces = CLN.piecesOf(St)[proof.sel];
      if (!(proof.paths[proof.sel] && proof.paths[proof.sel].length)) proof.paths[proof.sel] = [pieces[0]];
      msg = '';
      render();
    };
    A.clProofDel = () => { if (phase === 'proof' && proof.sel !== null) { delete proof.paths[proof.sel]; msg = ''; render(); } };
    A.clProofReset = () => { if (phase === 'proof') { proof = { paths: {}, sel: null }; msg = ''; render(); } };
    A.clProofDone = () => { if (phase === 'proof') proofDone(); };
    A.clNext = (e) => startRound(e.dataset.v);
    A.clEnd = endGame;

    // 증명 화면의 칸 입력: 터치는 한 칸씩 탭, 마우스는 드래그 지원
    clProofHandlers.down = (e, idx) => {
      if (phase !== 'proof') return;
      dragging = e.pointerType === 'mouse';
      dragLast = idx;
      proofTap(idx, false);
    };
    clProofHandlers.move = (e, idx) => {
      if (phase !== 'proof' || !dragging || idx === dragLast) return;
      dragLast = idx;
      proofTap(idx, true);
    };
    clProofHandlers.up = () => { dragging = false; dragLast = -1; };

    startRound(Math.random() < 0.5 ? 'me' : 'ai'); // 첫 선공은 무작위
    window.scrollTo(0, 0);
  }

  /* ---------- 이벤트 ---------- */
  const A = {
    home,
    rules,
    setup: setupScreen,
    start: startGame,
    next: roundIntro,
    playGame,
    placeholderDone,
    final: finalScreen,
    practiceMenu,
    gdLevel: (el) => { gradCfg.level = el.dataset.v; gradStart(); },
    gdMode: (el) => { gradCfg.mode = el.dataset.v; gradStart(); },
    clLevel: (el) => { clCfg.level = el.dataset.v; clStart(); },
    clMap: (el) => { clCfg.map = el.dataset.v; clStart(); },
    clMode: (el) => { clCfg.mode = el.dataset.v; clStart(); },
    clBegin: () => runColorLink({ practice: true, level: clCfg.level, map: clCfg.map, mode: clCfg.mode, oppId: 'p1' }),
    gdBegin: () => runGradation({ practice: true, level: gradCfg.level, mode: gradCfg.mode, oppId: 'p1' }),
    practiceStart: (el) => practiceStart(el.dataset.v),
    setN: (el) => {
      setup.n = +el.dataset.v;
      setupScreen();
    },
    setR: (el) => {
      setup.rounds = +el.dataset.v;
      setupScreen();
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act];
    if (fn) fn(el);
  });
  // 컬러 링크 증명: 터치는 탭, 마우스는 드래그
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('[data-cl-proof]');
    if (el && clProofHandlers.down) { e.preventDefault(); clProofHandlers.down(e, +el.dataset.i); }
  });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !clProofHandlers.move) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const c = el && el.closest && el.closest('[data-cl-proof]');
    if (c) clProofHandlers.move(e, +c.dataset.i);
  });
  document.addEventListener('pointerup', () => clProofHandlers.up && clProofHandlers.up());
  document.addEventListener('input', (e) => {
    if (e.target.id === 'nameInput') setup.name = e.target.value;
  });

  home();
})();
