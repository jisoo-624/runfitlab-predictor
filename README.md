# RunFitLab 예상 기록 계산기

5km 또는 10km 달리기 기록을 입력하면 **Riegel Formula**(지수 1.06)를 이용해 하프마라톤·풀마라톤 예상 완주 기록을 계산하고, 목표 페이스를 중심으로 한 **1km 페이스 밴드 표**를 보여주는 정적 웹사이트입니다.

## 주요 기능

- **예상 기록 계산**: 5km, 10km 기록 중 하나 이상 입력 (둘 다 입력하면 두 예측의 평균 사용)
- **1km 페이스 밴드 표**: 목표 페이스 대비 ±2/4/6% 구간별 페이스와 예상 완주 시간 (하프/풀 탭 전환)
- **결과 이미지 저장**: 계산 결과를 PNG 이미지로 다운로드 (Canvas API로 직접 렌더링, 외부 라이브러리 불필요)
- **반응형 디자인**: 모바일부터 데스크톱까지 대응
- **개인정보 미저장**: 입력한 기록과 계산 결과는 어디에도 저장되지 않으며, 브라우저 메모리 안에서만 계산됩니다 (localStorage, 쿠키, 서버 전송 없음)

## 계산 방식

Riegel Formula를 사용해 기준 기록으로부터 다른 거리의 예상 기록을 추정합니다.

```
T2 = T1 × (D2 / D1) ^ 1.06
```

- `T1`, `D1`: 입력한 기준 기록의 시간과 거리
- `T2`, `D2`: 예측하려는 거리(하프 21.0975km, 풀 42.195km)의 예상 시간

이 계산기는 추정치를 제공하며, 실제 레이스 결과는 컨디션, 코스, 날씨 등에 따라 달라질 수 있습니다.

## 실행 방법

빌드 과정이 필요 없는 순수 정적 사이트입니다. `index.html`을 브라우저로 열거나, 로컬 서버로 띄워서 확인할 수 있습니다.

```bash
python -m http.server 8080
# http://localhost:8080 접속
```

## 기술 스택

- HTML / CSS / Vanilla JavaScript (프레임워크, 빌드 도구, 외부 의존성 없음)

## 파일 구조

```
index.html   메인 페이지 마크업
style.css    반응형 스타일
script.js    Riegel 계산 로직, 페이스 밴드 렌더링, 이미지 저장(Canvas)
```

## 10km 완주 4주 루틴 (`/plan/10k/`)

5km 기록(또는 평소 1km 페이스)과 최근 한 달 러닝량, 앞으로 달릴 수 있는 횟수를 넣으면 4주 루틴 전체가 담긴 1080×1920 이미지 한 장을 만들어 줍니다. 명세는 [`SPEC.md`](SPEC.md)에 있습니다.

- 배포: https://jisoo-624.github.io/runfitlab-predictor/plan/10k/
- 입력값은 브라우저 밖으로 나가지 않고, 이미지도 canvas로 브라우저 안에서 그립니다.

```
plan/engine/core.js      거리 공통 로직 (페이스, 게이트, 티어 선택, buildPlan, 결과 링크)
plan/engine/plan-10k.js  10K 템플릿·세션 설정
plan/10k/                입력 UI(app.js), 이미지 렌더러(render.js), 스타일
tests/                   골든 케이스·불변식·링크 테스트
scripts/                 전수 결과표(matrix.js), 렌더 검수(render-matrix.mjs)
```

개발 명령 (Node 20+):

```bash
npm test                           # 엔진·링크 테스트
node scripts/matrix.js             # 480 조합 결과표 → reports/matrix-10k.md, .csv
npm install                        # 렌더 검수용 Playwright (개발 전용)
node scripts/render-matrix.mjs     # 37장 렌더 + 넘침 검사 → reports/contact-sheet.png
```
