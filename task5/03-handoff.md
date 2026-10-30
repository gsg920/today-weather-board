# 인수인계 (처음 보는 작업자용 — 이전 대화 없음)

## 1. 목표
`formatChange(prev, curr)`로 두 기온 변화량을 `+2.5°C` 형식으로 만들어 `app.js`의 "어제 대비"에 표시. 스펙·검사 정본은 `task5/01-checks.md`, `task5/checks.js`.

## 2. 현재 상태
- 저장소 버전 ID(commit): 08ae28aa6222ce65043c01fcd659d86f37eb46db (브랜치 main, 로컬)
- 구현됨: `format-change.js`에 부호+toFixed(1) 기본 경로만. 입력 검증·-0 처리 없음.
- `app.js`는 아직 `formatChange`를 쓰지 않음(68행의 인라인 계산 그대로, `index.html`에 format-change.js 미로드).

## 3. 실행 명령
```bash
git clone https://github.com/gsg920/today-weather-board.git   # 또는 로컬 폴더 복사
cd today-weather-board && git checkout 08ae28aa6222ce65043c01fcd659d86f37eb46db
bash task5/run-checks.sh      # Windows Git Bash + Edge. 마지막 줄 RESULT n/10
```
런타임: node 불필요(브라우저). Edge가 없으면 `tests.html`을 브라우저로 직접 열어도 같은 결과가 보임. 환경 변수·비밀값 없음.

## 4. 통과 검사
PASS: K01, K02, K03, K05(우연 가능), K06, K10 / FAIL: K04, K07, K08, K09 → 6/10

## 5. 남은 문제
- 첫 실패 K04: 10.04→10.00 이 "-0.0°C". 반올림 후 0이면 부호 제거 필요. 원인: diff<0이면 toFixed가 "-0.0" 반환.
- K07~K09: prev/curr가 유한한 숫자인지 검사 안 함.
- K05는 우연히 통과(부동소수). 반올림을 소수 안전하게 바꿀 것(예: 차이를 toPrecision(12)로 정리 후 0에서 먼 쪽으로 반올림).

## 6. 다음 행동
1. `format-change.js`: curr 검사(`현재 값 없음`) → prev 검사(`비교할 이전 기록 없음`) → 안전한 반올림 → 0이면 부호 없음.
2. `bash task5/run-checks.sh`로 10/10 확인.
3. `index.html`에 `<script src="format-change.js">`를 app.js보다 앞에 추가, `app.js` renderLastSuccess의 change 계산을 `formatChange(prior?.value, lastSuccess.value)`로 교체.
4. 04-ai-b-log.md 작성 후 commit.

## 7. 건드리지 말 것
`task5/checks.js`, `task5/01-checks.md`의 검사 10개·기대값·상한(60분/30회), `tests.html`의 판정 로직. 삭제·완화·기대값 변경 금지. 비밀값 파일 없음 — 만들지 말 것.
