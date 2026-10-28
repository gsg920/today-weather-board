const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=36.3504&longitude=127.3845&current=temperature_2m&hourly=temperature_2m&timezone=Asia%2FSeoul";
const STORAGE_KEY = "today-weather-board.records.v1";
const STATE_KEY = "today-weather-board.last-success.v1";
const $ = (id) => document.getElementById(id);

let uiState = "none";
let lastSuccess = loadJson(STATE_KEY, null);

function loadJson(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { $("message").textContent = "브라우저 저장소에 기록하지 못했습니다. 저장 공간/권한을 확인하세요."; return false; }
}
function kstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const o = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}
function formatKst(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(d);
}
function nowIso() { return new Date().toISOString(); }
function records() { return loadJson(STORAGE_KEY, []); }
function setStatus(status, message, isError = false) {
  uiState = status;
  $("status").textContent = ({none:"조회 전",fresh:"정상",stale:"오래된 데이터",error:"조회 실패"})[status] || status;
  $("status").style.color = status === "fresh" ? "#85e0b0" : status === "stale" || status === "error" ? "#ffb8b8" : "#d9e8ff";
  $("message").textContent = message;
  $("message").classList.toggle("error", isError);
}
function renderHistory() {
  const rows = records().sort((a,b) => b.date.localeCompare(a.date));
  $("recordCount").textContent = `${rows.length}건`;
  const body = $("historyBody");
  body.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 4; td.className = "empty"; td.textContent = "아직 기록이 없습니다."; tr.append(td); body.append(tr); return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    [row.date, `${row.value.toFixed(1)} ${row.unit}`, row.observedAt, "Open-Meteo"].forEach((v, i) => {
      const td = document.createElement("td"); td.textContent = v;
      if (i === 3) { const a = document.createElement("a"); a.href = row.sourceUrl; a.target = "_blank"; a.rel = "noreferrer"; a.textContent = v; td.replaceChildren(a); }
      tr.append(td);
    });
    body.append(tr);
  }
}
function renderLastSuccess() {
  if (!lastSuccess) return;
  $("temperature").textContent = lastSuccess.value.toFixed(1);
  $("observedAt").textContent = lastSuccess.observedAt;
  $("queriedAt").textContent = formatKst(lastSuccess.queriedAt);
  const all = records().sort((a,b) => a.date.localeCompare(b.date));
  const prior = all.filter(r => r.date < lastSuccess.date).at(-1);
  $("change").textContent = prior ? `${lastSuccess.value - prior.value >= 0 ? "+" : ""}${(lastSuccess.value-prior.value).toFixed(1)}°C` : "비교 기록 없음";
}
async function fetchWeather() {
  const button = $("refreshBtn"); button.disabled = true;
  setStatus("none", "공개 날씨 원천에 연결하고 있습니다…");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(API_URL, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!response.ok) {
      const err = new Error(`HTTP_${response.status}`); err.code = response.status === 429 ? "rate_limit" : response.status === 401 || response.status === 403 ? "denied" : "http"; throw err;
    }
    const data = await response.json();
    const value = data?.current?.temperature_2m;
    const observedAt = data?.current?.time;
    const unit = data?.current_units?.temperature_2m;
    if (typeof value !== "number" || !Number.isFinite(value) || typeof observedAt !== "string" || unit !== "°C") {
      const err = new Error("schema_changed"); err.code = "schema"; throw err;
    }
    const queriedAt = nowIso(), date = kstParts(new Date(queriedAt));
    const sourceUrl = API_URL;
    const snapshot = { date, value, unit, observedAt, queriedAt, sourceUrl, raw: data.current };
    const all = records();
    // One immutable successful snapshot per KST date; same-day refresh doesn't duplicate or overwrite it.
    if (!all.some(r => r.date === date)) {
      all.push(snapshot);
      saveJson(STORAGE_KEY, all);
    }
    lastSuccess = snapshot;
    saveJson(STATE_KEY, lastSuccess);
    renderLastSuccess(); renderHistory();
    setStatus("fresh", all.some(r => r.date === date && r.queriedAt !== queriedAt)
      ? "실제 조회 성공. 오늘 기록이 이미 있어 일별 기록은 중복 추가하지 않았습니다."
      : "실제 조회 성공. 오늘의 첫 정상 기록을 저장했습니다.");
  } catch (err) {
    const reason = err.name === "AbortError" ? "응답이 너무 늦어 시간 초과되었습니다." :
      err.code === "denied" ? "외부 원천이 접근을 거부했습니다 (401/403)." :
      err.code === "rate_limit" ? "요청 한도에 도달했습니다. 잠시 후 다시 시도하세요." :
      err.code === "schema" ? "응답 형식이 예상과 다릅니다. 데이터 구조를 확인해야 합니다." :
      !navigator.onLine ? "오프라인 상태입니다. 네트워크 연결을 확인하세요." :
      "외부 원천에 연결하지 못했습니다. 잠시 후 다시 시도하세요.";
    setStatus(lastSuccess ? "stale" : "error", `${reason} ${lastSuccess ? "마지막 정상값은 보존했습니다." : "아직 저장된 정상값이 없습니다."}`, true);
    if (lastSuccess) renderLastSuccess();
  } finally { button.disabled = false; }
}
const failures = {
  slow: ["응답 지연", "합성 응답이 제한 시간 안에 도착하지 않았습니다.", "네트워크 상태를 확인하고 다시 시도하세요."],
  denied: ["원천 접근 거부 (401/403)", "합성 시험에서 외부 원천이 요청을 거절했습니다.", "주소와 접근 정책을 확인하세요. 공개 API에 비밀키를 넣지 마세요."],
  limited: ["호출 제한 (429)", "합성 시험에서 요청 한도 초과 응답을 받았습니다.", "잠시 기다린 뒤 다시 시도하세요."],
  offline: ["오프라인", "합성 시험에서 네트워크 연결이 없는 것으로 처리했습니다.", "인터넷 연결을 확인한 뒤 다시 시도하세요."],
  schema: ["응답 형식 변경", "합성 응답에 필요한 기온/관측 시각/단위 필드가 없습니다.", "API 문서와 응답 필드를 대조하세요."]
};
document.querySelectorAll("[data-failure]").forEach(button => button.addEventListener("click", () => {
  const [title, detail, next] = failures[button.dataset.failure];
  setStatus(lastSuccess ? "stale" : "error", `${title}: ${detail} ${lastSuccess ? "마지막 정상값은 유지됩니다." : "정상 기록이 아직 없습니다."}`, true);
  $("testResult").innerHTML = `<b>${escapeHtml(title)}</b><br>${escapeHtml(detail)}<br><b>다음 행동:</b> ${escapeHtml(next)}`;
  if (lastSuccess) renderLastSuccess();
}));
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
$("refreshBtn").addEventListener("click", fetchWeather);
$("clearErrorBtn").addEventListener("click", () => {
  if (lastSuccess) { renderLastSuccess(); setStatus("fresh", "마지막 정상값을 다시 표시했습니다. 실제 최신 데이터가 필요하면 조회를 누르세요."); }
  else setStatus("none", "상태를 초기화했습니다. 실제 데이터를 조회하세요.");
  $("testResult").textContent = "상태 초기화 완료. 실패 재생은 합성 테스트입니다.";
});
$("recoverBtn").addEventListener("click", () => {
  if (lastSuccess) {
    renderLastSuccess(); setStatus("fresh", "합성 복구 확인: 상태 fresh, error_code none에 해당하는 정상 상태로 돌아왔습니다. 실제 원천 최신값은 조회 버튼으로 확인하세요.");
    $("testResult").textContent = "복구 데모 완료. 일별 기록은 변경하지 않았습니다.";
  } else {
    setStatus("none", "복구할 마지막 정상값이 없습니다. 먼저 실제 데이터 조회를 실행하세요.");
    $("testResult").textContent = "복구 보류: 마지막 정상값이 없습니다.";
  }
});
renderHistory();
if (lastSuccess) { renderLastSuccess(); setStatus("stale", "저장된 마지막 정상값입니다. 최신값 확인을 위해 실제 데이터 조회를 실행하세요."); }
