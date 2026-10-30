"use strict";
/* 합성 fixture 재생. 실제 기록(live.v2)과 저장소를 분리해 둔다. */
const REPLAY_KEY = "today-weather-board.replay.v1";
const C = window.T04Core;
const FIXTURES = window.T04_FIXTURES;

let replay = C.loadState(localStorage, REPLAY_KEY);
let lastFixtureId = null;

const BASE = ["T04-NORMAL-D1-A", "T04-NORMAL-D1-B"];
const SEQUENCES = {
  success: [...BASE, "T04-NORMAL-D2"],
  timeout: [...BASE, "T04-TIMEOUT"], auth: [...BASE, "T04-AUTH-401"], rate: [...BASE, "T04-RATE-429"],
  offline: [...BASE, "T04-OFFLINE"], schema: [...BASE, "T04-SCHEMA-BREAK"],
  recoverReady: [...BASE, "T04-TIMEOUT"]
};

function replayReset() { replay = C.resetState(); lastFixtureId = null; C.saveState(localStorage, REPLAY_KEY, replay); renderReplay(); }
function replayRun(id) {
  const fx = FIXTURES[id]; if (!fx) throw new Error(`unknown fixture ${id}`);
  replay = C.runFixture(replay, fx); lastFixtureId = id;
  C.saveState(localStorage, REPLAY_KEY, replay); renderReplay();
  return replay;
}
function replaySequence(key) { replayReset(); SEQUENCES[key].forEach(replayRun); return replay; }

function matchesExpected(fx) {
  if (!fx) return null;
  const e = fx.expected, s = replay, cur = s.current_reading;
  return {
    freshness: s.status && s.status.freshness === e.freshness,
    error_code: s.status && s.status.error_code === e.error_code,
    row_count: s.daily_readings.length === e.row_count,
    stored_value: (cur ? cur.normalized_value : null) === e.stored_value,
    delta: s.last_delta === e.delta
  };
}

function renderReplay() {
  const s = replay, cur = s.current_reading;
  $("rpStatus").textContent = statusText(s.status);
  $("rpRows").textContent = `${s.daily_readings.length}건`;
  $("rpValue").textContent = cur ? `${num(cur.normalized_value)} ${cur.unit}` : "-";
  $("rpStale").hidden = !(s.status && s.status.freshness === "stale");
  $("rpDelta").textContent = changeText(s.last_comparison);
  $("rpLast").textContent = lastFixtureId ? `${lastFixtureId} → ${s.last_run.outcome === "success" ? "성공" : ERROR_TEXT[s.last_run.error_code]}` : "reset 상태";
  const chk = matchesExpected(FIXTURES[lastFixtureId]);
  $("rpCheck").textContent = !chk ? "-" : Object.values(chk).every(Boolean) ? "fixture 기대값과 일치" : "불일치: " + Object.entries(chk).filter(([, v]) => !v).map(([k]) => k).join(", ");
  renderRows($("rpBody"), $("rpCount"), s, false);
  $("rpHint").textContent = s.status && s.status.freshness === "stale"
    ? `${NEXT_ACTION[s.status.error_code]} 마지막 정상값 ${cur ? num(cur.normalized_value) : "-"}은 유지됩니다.` : "";
}

document.querySelectorAll("[data-seq]").forEach((b) => b.addEventListener("click", () => replaySequence(b.dataset.seq)));
$("rpReset").addEventListener("click", replayReset);
$("rpRetry").addEventListener("click", () => replayRun("T04-RECOVER-D2"));

// 자동 점검용: 콘솔에서 T04.sequence("success") 등으로 호출할 수 있다.
window.T04 = { reset: replayReset, run: replayRun, sequence: replaySequence, state: () => JSON.parse(JSON.stringify(replay)) };

renderReplay();
