# 오늘의 날씨 변화판

대전의 현재 기온을 Open-Meteo 공개 API에서 조회하고, Asia/Seoul 날짜 기준으로 하루 첫 성공 기록을 보존하는 정적 웹 프로젝트입니다.

## 실행
`index.html`을 브라우저에서 열거나 GitHub Pages에 배포하세요. 브라우저 보안 정책에 따라 `file://`에서 API 호출이 제한될 수 있으므로 로컬 서버(예: VS Code Live Server)를 권장합니다.

## 데이터
- 원천: https://open-meteo.com/
- API: `https://api.open-meteo.com/v1/forecast`
- 위치: 대전 좌표 36.3504, 127.3845
- 값: `current.temperature_2m`
- 단위: °C
- 시간대: Asia/Seoul
- 관측 시각: API의 `current.time`
- 조회 시각: 브라우저가 기록한 ISO timestamp
- 저장: localStorage. 브라우저/기기 간 동기화되지 않습니다.

## 테스트 범위 및 한계
실패 재생 버튼은 합성 테스트이며 실제 API의 HTTP 401/403, 429 또는 오프라인을 발생시키지 않습니다. 실제 API가 반환한 오류와 합성 오류를 구분해서 제출하세요. `localStorage`는 현재 브라우저에만 기록을 보존하므로, 심사자가 다른 기기에서 동일 기록을 볼 수 있어야 한다면 서버 측 영속 저장소가 추가로 필요합니다.

과제 안내에 명시된 `public-contract.json`, `asset-manifest.json`, 참조 adapter, `T04-RECOVER-D2` 원본은 이 프로젝트에 포함되어 있지 않습니다. 제공 자료를 받으면 과제에서 요구한 규격에 맞춰 통합해야 합니다.

## 제출 전 확인
1. 공개 원천에서 실제 조회가 성공하는가?
2. 화면에 값, 단위, 출처, 관측 시각, 조회 시각, 기준 시간대가 보이는가?
3. 첫날 실제 기록을 저장하고 다른 KST 날짜에 다시 실행했는가?
4. 두 실제 기록의 변화량을 직접 계산해 화면과 대조했는가?
5. 개발자 도구와 Git 기록에 비밀키나 개인정보가 없는가?
