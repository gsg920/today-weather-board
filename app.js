"use strict";
const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=36.3504&longitude=127.3845&current=temperature_2m&timezone=Asia%2FSeoul";
const SIGNAL_ID = "daejeon-temperature-2m";
const LIVE_KEY = "today-weather-board.live.v2";      // 실제 조회 저장소
const LEGACY_KEY = "today-weather-board.records.v1";
const FETCH_DEADLINE_MS = 9000;
const C = window.T04Core;

let live = C.loadState(localStorage, LIVE_KEY);

function renderLive() {
  const cur = live.current_reading;
  $("temperature").textContent = cur ? num(cur.normalized_value) : "--.-";
  $("unit").textContent = cur ? cur.unit : "°C";
  $("observedAt").textContent = cur ? fmtKst(cur.source_time) : "-";
  $("queriedAt").textContent = cur ? fmtKst(cur.fetched_at) : "-";
  $("change").textContent = changeText(live.last_comparison);
  const st = $("status");
  st.textContent = statusText(live.status);
  st.style.color = !live.status ? "#d9e8ff" : live.status.freshness === "fresh" ? "#85e0b0" : "#ffb8b8";
  $("weatherText").textContent = cur ? `${cur.record_date} 기록 · 마지막 정상값` : "아직 조회하지 않았습니다.";
  if (cur) { $("sourceLink").href = cur.source_url; $("sourceLink").textContent = cur.source_name; $("sourceUrl").textContent = cur.source_url; }
  $("staleBadge").hidden = !(live.status && live.status.freshness === "stale");
  renderRows($("historyBody"), $("recordCount"), live, true);
}
function setMessage(text, isError) { $("message").textContent = text; $("message").classList.toggle("error", !!isError); }

function classifyFetchError(err) {
  if (err && err.name === "AbortError") return "timeout";
  if (err && err.httpStatus === 401 || err && err.httpStatus === 403) return "auth";
  if (err && err.httpStatus === 429) return "rate_limit";
  if (err && err.httpStatus) return "schema_error";
  if (err instanceof SyntaxError || err instanceof TypeError && err.message === "unexpected response shape" || err instanceof TypeError && err.message === "unexpected time format") return "schema_error";
  return "offline";   // fetch가 네트워크 계층에서 실패
}

async function fetchLive() {
  const btn = $("refreshBtn"); btn.disabled = true;
  setMessage("공개 날씨 원천에 연결하고 있습니다…");
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_DEADLINE_MS);
    let res;
    try { res = await fetch(API_URL, { signal: ctl.signal, cache: "no-store" }); }
    finally { clearTimeout(timer); }
    if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.httpStatus = res.status; throw e; }
    const data = await res.json();
    const reading = C.normalizeOpenMeteo(data, new Date().toISOString(), API_URL, SIGNAL_ID);
    const next = C.applySuccessfulReading(live, reading);
    if (!C.saveState(localStorage, LIVE_KEY, next)) throw new Error("storage");
    live = next;
    const sameDay = live.daily_readings.find((r) => r.record_date === reading.record_date);
    setMessage(sameDay.first_fetched_at !== sameDay.last_fetched_at
      ? "조회 성공. 오늘 기록이 이미 있어 새 행 없이 같은 행의 값을 갱신했습니다."
      : "조회 성공. 오늘의 새 일별 기록을 저장했습니다.");
  } catch (err) {
    if (err && err.message === "storage") { setMessage("브라우저 저장소에 기록하지 못했습니다. 저장 공간/권한을 확인하세요.", true); }
    else {
      const code = classifyFetchError(err);
      live = C.applyError(live, code, { virtual_now: new Date().toISOString() });
      C.saveState(localStorage, LIVE_KEY, live);
      setMessage(`${ERROR_TEXT[code]}. ${live.current_reading ? `마지막 정상값 ${num(live.current_reading.normalized_value)} ${live.current_reading.unit}은 보존했습니다.` : "아직 저장된 정상값이 없습니다."} ${NEXT_ACTION[code]}`, true);
    }
  } finally { btn.disabled = false; renderLive(); }
}

// 이전 버전(v1) 실제 기록은 새 일별 행으로 옮긴다. 한 번만 실행된다.
function migrateLegacy() {
  if (live.daily_readings.length) return;
  let old; try { old = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]"); } catch { return; }
  if (!Array.isArray(old)) return;
  let s = C.resetState();
  for (const r of old.sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    try {
      s = C.applySuccessfulReading(s, {
        signal_id: SIGNAL_ID, normalized_value: r.value, unit: "°C", source_name: "Open-Meteo Forecast API",
        source_url: API_URL, source_time: new Date(`${r.observedAt}:00+09:00`).toISOString(), fetched_at: r.queriedAt,
        record_timezone: "Asia/Seoul", record_date: C.kstDate(r.queriedAt)
      });
    } catch { /* 형식이 맞지 않는 옛 기록은 건너뜀 */ }
  }
  if (s.daily_readings.length) { live = s; C.saveState(localStorage, LIVE_KEY, live); }
}

$("refreshBtn").addEventListener("click", fetchLive);
$("retryBtn").addEventListener("click", fetchLive);

// 점검용: 콘솔에서 T04live.state()로 실제 기록을 볼 수 있다.
window.T04live = { state: () => JSON.parse(JSON.stringify(live)) };

migrateLegacy();
renderLive();
if (live.current_reading) setMessage("저장된 마지막 정상값입니다. 최신값은 ‘실제 데이터 조회’로 확인하세요.");
