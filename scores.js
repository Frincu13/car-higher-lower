// One shape for every finished run, so a leaderboard can be added later without
// touching the games again: they only call Scores.finish(run) and show what comes back.
//
// A run is { game, board, score, timeMs, ... }. `board` is what runs are compared
// within (game + category + clock), `score` is what the player chases and `timeMs` is
// the thinking time, measured to the millisecond and shown to the hundredth. On equal
// score the shorter time wins, which is why the clock lengths are fixed in code.
window.Scores = (() => {
  'use strict';

  const { store } = window.Shared;
  const VERSION = 1;               // bump when a run's meaning changes (rules, clock, pool)
  const KEY = k => `frq_best_${k}`;

  // mm:ss.cc, or ss.cc under a minute
  function time(ms) {
    if (ms == null) return '';
    const cs = Math.round(ms / 10), s = Math.floor(cs / 100), m = Math.floor(s / 60);
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return (m ? `${m}:${pad(s % 60)}` : `${s % 60}`) + `.${pad(cs % 100)}`;
  }

  function start({ game, board, mode = 'solo', cat = null, timed = false, seconds = 0, seed = null }) {
    return {
      v: VERSION, game, board, mode, cat, timed, seconds, seed,
      score: 0, timeMs: 0, turns: 0,
      startedAt: Date.now(), endedAt: null,
    };
  }

  // The only rule the whole site uses to compare two runs on the same board.
  // Same score: the shorter time wins. An old record with no time on it (saved before
  // runs were timed) loses to an equal score that has one.
  const better = (run, old) => !old || run.score > old.score
    || (run.score === old.score && (old.timeMs == null || run.timeMs < old.timeMs));

  const load = board => store.get(KEY(board), null);

  // Called once, when a run is over. Saves the personal best and hands back what to
  // show. The server call for a shared leaderboard goes in here, nowhere else.
  function finish(run, score) {
    run.score = score;
    run.endedAt = Date.now();
    const old = load(run.board);
    const record = better(run, old);
    if (record) {
      store.set(KEY(run.board), {
        v: run.v, score: run.score, timeMs: run.timeMs, turns: run.turns, at: run.endedAt,
      });
    }
    submit(run);
    return { record, best: load(run.board) };
  }

  // Not wired to anything yet: a leaderboard would send the run from here. Kept as one
  // function so the games never learn about the network.
  function submit(run) {
    if (!window.Leaderboard || typeof Leaderboard.submit !== 'function') return;
    try { Leaderboard.submit(run); } catch { /* a board that is down never breaks a game */ }
  }

  // Old records were a plain number of points, with no time attached.
  function migrate(oldKey, board) {
    const old = store.get(oldKey, null);
    if (typeof old !== 'number' || !old || load(board)) return;
    store.set(KEY(board), { v: VERSION, score: old, timeMs: null, turns: 0, at: null });
  }

  return { start, finish, load, better, time, migrate, VERSION };
})();
