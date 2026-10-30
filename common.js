"use strict";
/* index.html(실제 조회)과 verify.html(합성 재생)이 함께 쓰는 표시 함수. */
const $ = (id) => document.getElementById(id);

const ERROR_TEXT = {
  none: "정상",
  timeout: "응답 시간 초과 (timeout)",
  auth: "외부 원천이 접근을 거부함 (401/403)",
  rate_limit: "호출 제한 (429)",
  offline: "오프라인",
  schema_error: "응답 형식 변경 (schema_error)"
};
const NEXT_ACTION = {
  timeout: "네트워크를 확인하고 ‘다시 시도’를 누르세요.",
  auth: "원천 주소와 접근 정책을 확인하세요. 공개 앱에 비밀키를 넣지 마세요.",
  rate_limit: "잠시 기다린 뒤 ‘다시 시도’를 누르세요.",
  offline: "인터넷 연결을 확인한 뒤 ‘다시 시도’를 누르세요.",
  schema_error: "원천 응답 필드를 문서와 대조하세요."
};

function fmtKst(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d) + " KST";
}
function num(v) { return String(v); }   // 원자료·저장값·화면값이 같은 문자열이 되도록 반올림하지 않는다 (C10)
function changeText(cmp) {
  if (cmp.state === "insufficient") return "비교 기록 없음";
  if (cmp.state === "unit_mismatch") return "단위가 달라 비교 불가";
  const sign = cmp.direction === "increase" ? "+" : cmp.direction === "decrease" ? "-" : "±";
  return `${sign}${num(cmp.magnitude)} ${cmp.unit}`;
}
function statusText(s) {
  if (!s) return "조회 전";
  return s.freshness === "fresh" ? "정상 (fresh / none)" : `오래된 데이터 (stale / ${s.error_code})`;
}
function el(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }

function renderRows(body, countEl, state, sourceLink) {
  const rows = [...state.daily_readings].sort((a, b) => b.record_date.localeCompare(a.record_date));
  countEl.textContent = `${rows.length}건`;
  body.replaceChildren();
  if (!rows.length) {
    const tr = el("tr"), td = el("td", "아직 기록이 없습니다.", "empty"); td.colSpan = 5; tr.append(td); body.append(tr); return;
  }
  for (const r of rows) {
    const tr = el("tr");
    tr.append(el("td", r.record_date), el("td", `${num(r.normalized_value)} ${r.unit}`), el("td", fmtKst(r.reading.source_time)), el("td", fmtKst(r.last_fetched_at)));
    const td = el("td");
    if (sourceLink) { const a = el("a", r.reading.source_name); a.href = r.reading.source_url; a.target = "_blank"; a.rel = "noreferrer"; td.append(a); }
    else td.textContent = r.reading.source_name;
    tr.append(td); body.append(tr);
  }
}
