# 오늘의 날씨 변화판 (T04 오늘의 진짜 정보판)

대전의 현재 기온을 Open-Meteo 공개 API에서 조회해 값·단위·출처·출처 시각·조회 시각·기준 시간대(Asia/Seoul)를 보여 주고, 일별로 저장해 전일 대비를 계산하는 정적 웹 프로젝트입니다. 로그인·계정·비밀키는 없습니다.

## 실행
`index.html`을 로컬 서버로 열거나 GitHub Pages에 배포하세요(`file://`에서는 API 호출이 막힐 수 있음). 예: `python -m http.server`.

## 구조
| 파일 | 역할 |
|---|---|
| `board-core.js` | 정규화 검증, 일별 upsert, 실패 상태 전이, 전일 대비 계산. live와 replay가 같은 함수를 호출 |
| `fixtures.js` | ALEPH 공개 fixture 9종 (원본 JSON을 한 파일로 묶음) |
| `index.html` + `app.js` | 날씨 변화판 화면, 실제 조회(live adapter) |
| `verify.html` + `verify.js` | 검증 화면, fixture 재생(replay adapter). 변화판의 ‘검증 화면으로 이동’ 버튼으로 진입 |
| `common.js` | 두 화면이 함께 쓰는 표시 함수 |
| `T04.*` (verify 콘솔) | `T04.sequence("success")`, `T04.run("T04-RECOVER-D2")`, `T04.state()` 등 점검용 |

## 데이터
- 원천: https://open-meteo.com/ , API `https://api.open-meteo.com/v1/forecast`, 위치 대전(36.3504, 127.3845)
- 값: `current.temperature_2m`, 단위 °C, `signal_id` = `daejeon-temperature-2m`
- 출처 시각: API의 `current.time`(KST) / 조회 시각: 브라우저가 기록한 `fetched_at`
- 저장: localStorage(이 브라우저에만 보존). 실제 기록(`today-weather-board.live.v2`)과 합성 재생(`...replay.v1`)은 저장소가 분리되어 있습니다.

## 저장·실패 규칙 (과제 규격)
- 같은 `signal_id + record_date`는 새 행 없이 같은 `record_id`로 갱신합니다(상태 객체를 만든 뒤 한 번에 저장).
- 다음 Asia/Seoul 날짜의 성공 조회는 새 일별 행을 만듭니다. 전일 대비는 저장된 두 행으로 매번 다시 계산합니다.
- 실패(timeout / auth / rate_limit / offline / schema_error)는 기존 행과 마지막 정상값을 바꾸지 않고 `stale / error_code`만 기록합니다. 성공하면 `fresh / none`으로 돌아옵니다.
- `auth`는 외부 원천의 401/403입니다. 이 앱의 로그인과는 무관합니다.

## fixture 재생
`verify.html`의 ‘합성 fixture 재생’에서 정상·일별 저장, 실패 5종, 회복(‘회복 준비’ 후 ‘다시 시도 → T04-RECOVER-D2’)을 재생할 수 있고, 각 단계가 fixture의 `expected`와 맞는지 표시합니다. 합성 날짜(2026-08-24/25)와 값은 실제 조회 증거가 아닙니다.

## 남은 일 (코드로 대신할 수 없음)
- T04-C03~C10, C22~C24: 실제 공개 원천을 **서로 다른 KST 날짜 이틀에** 조회해 저장해야 합니다(제출 시 `t04_day` 영수증 2건).
- localStorage는 심사자의 다른 기기에서 보이지 않습니다. 기기 간 공유가 필요하면 서버 저장소를 추가하세요.
- 이전 버전(v1)의 실제 기록은 첫 실행 때 새 구조로 자동 이전됩니다.
- 공개 URL은 새 시크릿 창에서 인증 없이 열리는지 확인하세요.
