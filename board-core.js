'use strict';
/* T04 저장·정규화·실패 상태 전이. live 조회와 fixture 재생이 모두 이 파일의 같은 함수를 지난다.
   상태 전이는 ALEPH 참조 adapter(adapter-reset.example.js)의 계약을 따른다. */
(function (root) {
  const NORMALIZED_KEYS = ["signal_id", "normalized_value", "unit", "source_name", "source_url",
    "source_time", "fetched_at", "record_timezone", "record_date"];
  const ERROR_CODES = ["timeout", "auth", "rate_limit", "offline", "schema_error"];

  const clone = (v) => JSON.parse(JSON.stringify(v));

  function kstDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new TypeError("fetched_at must be a valid ISO-8601 date-time");
    const p = Object.fromEntries(new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }

  function validateNormalizedReading(r) {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new TypeError("normalized reading must be an object");
    const actual = Object.keys(r).sort(), expected = [...NORMALIZED_KEYS].sort();
    if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) throw new TypeError("normalized reading keys mismatch");
    if (typeof r.signal_id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(r.signal_id) || r.signal_id.length > 100) throw new TypeError("signal_id is invalid");
    if (typeof r.normalized_value !== "number" || !Number.isFinite(r.normalized_value)) throw new TypeError("normalized_value must be a finite number");
    for (const f of ["unit", "source_name"]) {
      if (typeof r[f] !== "string" || r[f].trim() === "") throw new TypeError(`${f} must be a non-empty string`);
    }
    let u; try { u = new URL(r.source_url); } catch { throw new TypeError("source_url must be an absolute URL"); }
    if (u.protocol !== "https:") throw new TypeError("source_url must use HTTPS");
    if (r.source_time !== null && (typeof r.source_time !== "string" || Number.isNaN(new Date(r.source_time).getTime()))) throw new TypeError("source_time is invalid");
    if (typeof r.fetched_at !== "string" || Number.isNaN(new Date(r.fetched_at).getTime())) throw new TypeError("fetched_at is invalid");
    if (r.record_timezone !== "Asia/Seoul") throw new TypeError("record_timezone must be Asia/Seoul");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.record_date) || r.record_date !== kstDate(r.fetched_at)) throw new TypeError("record_date must be the Asia/Seoul date of fetched_at");
    return true;
  }

  function resetState() {
    return {
      schema_version: "aleph-t04-evaluation-state-v1",
      daily_readings: [], current_reading: null, status: null, last_delta: null,
      last_comparison: { state: "insufficient", direction: null, magnitude: null, unit: null },
      last_run: null, sequence: 0
    };
  }

  // 전일 대비는 저장된 두 일별 행의 값으로 매번 다시 계산한다.
  function comparisonFor(rows, cur) {
    const prev = rows.filter((x) => x.signal_id === cur.signal_id && x.record_date < cur.record_date)
      .sort((a, b) => b.record_date.localeCompare(a.record_date))[0];
    if (!prev) return { state: "insufficient", direction: null, magnitude: null, unit: null };
    if (prev.unit !== cur.unit) return { state: "unit_mismatch", direction: null, magnitude: null, unit: null };
    const diff = Math.round((cur.normalized_value - prev.normalized_value) * 1e6) / 1e6;
    return { state: "comparable", direction: diff > 0 ? "increase" : diff < 0 ? "decrease" : "unchanged", magnitude: Math.abs(diff), unit: cur.unit };
  }

  // 같은 signal_id + record_date는 행을 늘리지 않고 같은 record_id로 갱신한다. 새 상태 객체를 돌려주므로
  // 호출자가 한 번에 저장하면 중간 상태가 남지 않는다.
  function applySuccessfulReading(input, reading, meta = {}) {
    validateNormalizedReading(reading);
    const s = clone(input);
    const i = s.daily_readings.findIndex((x) => x.signal_id === reading.signal_id && x.record_date === reading.record_date);
    const old = i >= 0 ? s.daily_readings[i] : null;
    const row = {
      record_id: old ? old.record_id : `rec-${reading.signal_id}-${reading.record_date}`,
      signal_id: reading.signal_id, record_date: reading.record_date,
      normalized_value: reading.normalized_value, unit: reading.unit,
      first_fetched_at: old ? old.first_fetched_at : reading.fetched_at,
      last_fetched_at: reading.fetched_at, reading: clone(reading)
    };
    if (i >= 0) s.daily_readings[i] = row; else s.daily_readings.push(row);
    s.daily_readings.sort((a, b) => a.record_date.localeCompare(b.record_date));
    s.current_reading = clone(reading);
    s.status = { freshness: "fresh", error_code: "none" };
    s.last_comparison = comparisonFor(s.daily_readings, row);
    s.last_delta = s.last_comparison.magnitude;
    s.sequence += 1;
    s.last_run = { fixture_id: meta.fixture_id || null, virtual_now: meta.virtual_now || reading.fetched_at, outcome: "success", error_code: "none", retry_after_seconds: null };
    return s;
  }

  // 실패는 daily_readings·current_reading·last_comparison을 건드리지 않고 상태만 stale로 바꾼다.
  function applyError(input, code, meta = {}) {
    if (!ERROR_CODES.includes(code)) throw new TypeError(`unsupported error code: ${code}`);
    const s = clone(input);
    s.status = { freshness: "stale", error_code: code };
    s.sequence += 1;
    s.last_run = { fixture_id: meta.fixture_id || null, virtual_now: meta.virtual_now || null, outcome: "error", error_code: code, retry_after_seconds: meta.retry_after_seconds ?? null };
    return s;
  }

  function runFixture(input, fx) {
    const t = fx.transport;
    const meta = { fixture_id: fx.fixture_id, virtual_now: fx.virtual_now, retry_after_seconds: t.headers["retry-after"] ? Number(t.headers["retry-after"]) : null };
    if (t.mode === "timeout") return applyError(input, "timeout", meta);
    if (t.mode === "offline") return applyError(input, "offline", meta);
    if (t.status === 401 || t.status === 403) return applyError(input, "auth", meta);
    if (t.status === 429) return applyError(input, "rate_limit", meta);
    if (t.status >= 200 && t.status < 300) {
      try { return applySuccessfulReading(input, fx.payload, meta); }
      catch { return applyError(input, "schema_error", meta); }
    }
    return applyError(input, "schema_error", meta);
  }

  // Open-Meteo 응답 -> 정규화 형식. 형식이 어긋나면 schema_error 대상이므로 던진다.
  function normalizeOpenMeteo(data, fetchedAt, sourceUrl, signalId) {
    const c = data && data.current, u = data && data.current_units;
    if (!c || typeof c.temperature_2m !== "number" || !Number.isFinite(c.temperature_2m) ||
        typeof c.time !== "string" || !u || u.temperature_2m !== "°C") throw new TypeError("unexpected response shape");
    const t = new Date(`${c.time}:00+09:00`);   // timezone=Asia/Seoul 요청이므로 현지 시각 문자열
    if (Number.isNaN(t.getTime())) throw new TypeError("unexpected time format");
    return {
      signal_id: signalId, normalized_value: c.temperature_2m, unit: "°C",
      source_name: "Open-Meteo Forecast API", source_url: sourceUrl,
      source_time: t.toISOString(), fetched_at: fetchedAt,
      record_timezone: "Asia/Seoul", record_date: kstDate(fetchedAt)
    };
  }

  function loadState(storage, key) {
    try { const v = storage.getItem(key); if (v) { const s = JSON.parse(v); if (s && Array.isArray(s.daily_readings)) return s; } } catch { /* 저장소 사용 불가 */ }
    return resetState();
  }
  function saveState(storage, key, state) {
    try { storage.setItem(key, JSON.stringify(state)); return true; } catch { return false; }
  }

  const api = { ERROR_CODES, kstDate, validateNormalizedReading, resetState, comparisonFor, applySuccessfulReading, applyError, runFixture, normalizeOpenMeteo, loadState, saveState };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.T04Core = api;
})(typeof window !== "undefined" ? window : globalThis);
