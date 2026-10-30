#!/usr/bin/env bash
# 저장소 루트에서 실행. Windows Edge 헤드리스로 tests.html 을 열어 결과를 출력한다.
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless --disable-gpu --dump-dom "file:///$(pwd -W)/tests.html" 2>/dev/null | sed -n '/<pre/,/<\/pre>/p' | sed 's/<[^>]*>//g'
