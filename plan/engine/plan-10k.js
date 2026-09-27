// 10K 완주 4주 루틴 설정 (SPEC 5.1, 5.4, 5.5, 7.4)

// 세션: [앵커 기준 오프셋(일), 세션ID, km]. 앵커 = 롱런 요일(4주차는 레이스).
const TEMPLATES = {
  basic: {
    2: [
      [[-4, "easy", 5], [0, "long", 6]],
      [[-4, "easy", 5], [0, "long", 7.5]],
      [[-4, "easy", 5], [0, "long", 8.5]],
      [[-4, "sharpen", 3], [0, "race", 10]],
    ],
    3: [
      [[-5, "easy", 5], [-3, "int5", 5], [0, "long", 6]],
      [[-5, "easy", 5], [-3, "tempo5", 5], [0, "long", 7.5]],
      [[-5, "easy", 5], [-3, "int6", 5], [0, "long", 8.5]],
      [[-5, "easy", 4], [-3, "sharpen", 3], [0, "race", 10]],
    ],
    4: [
      [[-6, "easy", 4], [-4, "int5", 5], [-2, "easy", 4], [0, "long", 6]],
      [[-6, "easy", 4], [-4, "tempo5", 5], [-2, "easy", 4], [0, "long", 7.5]],
      [[-6, "easy", 4], [-4, "int6", 5], [-2, "easy", 5], [0, "long", 8.5]],
      [[-6, "easy", 4], [-4, "sharpen", 3], [-2, "easy", 3], [0, "race", 10]],
    ],
    5: [
      [[-6, "easy", 4], [-5, "int5", 5], [-4, "easy", 4], [-2, "tempo4", 4], [0, "long", 6]],
      [[-6, "easy", 4], [-5, "tempo5", 5], [-4, "easy", 4], [-2, "int5", 5], [0, "long", 7.5]],
      [[-6, "easy", 4], [-5, "int6", 5], [-4, "easy", 5], [-2, "tempo5", 5], [0, "long", 8.5]],
      [[-6, "easy", 4], [-5, "sharpen", 3], [-3, "easy", 3], [0, "race", 10]],
    ],
  },
  gentle: {
    2: [
      [[-4, "easy", 4.5], [0, "long", 5]],
      [[-4, "easy", 4], [0, "long", 6.5]],
      [[-4, "easy", 4], [0, "long", 7.5]],
      [[-4, "sharpen", 3], [0, "race", 10]],
    ],
    3: [
      [[-5, "easy", 4], [-3, "int4", 4], [0, "long", 5]],
      [[-5, "easy", 4], [-3, "tempo4", 4], [0, "long", 6.5]],
      [[-5, "easy", 4], [-3, "int4", 4], [0, "long", 7.5]],
      [[-5, "easy", 3], [-3, "sharpen", 3], [0, "race", 10]],
    ],
    4: [
      [[-6, "easy", 3], [-4, "int4", 4], [-2, "easy", 3], [0, "long", 5]],
      [[-6, "easy", 3], [-4, "tempo4", 4], [-2, "easy", 3.5], [0, "long", 6.5]],
      [[-6, "easy", 3.5], [-4, "int4", 4], [-2, "easy", 3.5], [0, "long", 7.5]],
      [[-6, "easy", 3], [-4, "sharpen", 3], [-2, "easy", 3], [0, "race", 10]],
    ],
    5: [
      [[-6, "easy", 3], [-5, "int4", 4], [-4, "easy", 3], [-2, "easy", 3], [0, "long", 5]],
      [[-6, "easy", 3], [-5, "tempo4", 4], [-4, "easy", 3], [-2, "easy", 3.5], [0, "long", 6.5]],
      [[-6, "easy", 3.5], [-5, "int4", 4], [-4, "easy", 3.5], [-2, "easy", 3.5], [0, "long", 7.5]],
      [[-6, "easy", 3], [-5, "sharpen", 3], [-3, "easy", 3], [0, "race", 10]],
    ],
  },
};

// kind: 7.3 칸 스타일. guideKey: 5.7 매핑표의 일반 모드 키(quality만 sessionId로 구분).
// runWalkSub: 런-워크 모드에서 이지(런-워크)로 치환되는 세션 (5.5).
const SESSIONS = {
  easy: { kind: "easy", cellLabel: "이지", cellSub: null, pace: "easy" },
  long: { kind: "long", cellLabel: "롱런", cellSub: null, pace: "easy" },
  int4: {
    kind: "quality", cellLabel: "인터벌", cellSub: "400m×4", pace: "interval", guideKey: "interval", runWalkSub: true,
    parts: [["워밍업", 1], ["400m×4(사이 200m 조깅)", 2.2], ["쿨다운", 0.8]],
  },
  int5: {
    kind: "quality", cellLabel: "인터벌", cellSub: "400m×5", pace: "interval", guideKey: "interval", runWalkSub: true,
    parts: [["워밍업", 1.2], ["400m×5(사이 200m)", 2.8], ["쿨다운", 1.0]],
  },
  int6: {
    kind: "quality", cellLabel: "인터벌", cellSub: "400m×6", pace: "interval", guideKey: "interval", runWalkSub: true,
    parts: [["워밍업", 1.0], ["400m×6(사이 200m)", 3.4], ["쿨다운", 0.6]],
  },
  tempo4: {
    kind: "quality", cellLabel: "템포", cellSub: "2km", pace: "tempo", guideKey: "tempo", runWalkSub: true,
    parts: [["워밍업", 1], ["템포", 2], ["쿨다운", 1]],
  },
  tempo5: {
    kind: "quality", cellLabel: "템포", cellSub: "2.5km", pace: "tempo", guideKey: "tempo", runWalkSub: true,
    parts: [["워밍업", 1.5], ["템포", 2.5], ["쿨다운", 1]],
  },
  sharpen: { kind: "quality", cellLabel: "자극", cellSub: "가속주 4회", pace: "easy", guideKey: "sharpen" },
  race: { kind: "race", cellLabel: "도전", cellSub: null, pace: "goal" },
};

const GUIDE_TEXT = {
  easy: "이지·롱런: 대화가 가능한 속도. 느려도 그대로",
  interval: "인터벌: 워밍업 1km → 400m를 {interval}/km로, 사이 200m 천천히 조깅 → 쿨다운",
  tempo: "템포: 워밍업 1~1.5km → {tempo}/km로 2~2.5km 유지 → 쿨다운 1km",
  sharpen: "자극: 이지 2km 뒤 100m 가속주 4회. 다리만 깨우는 날",
  runwalk: "런-워크: 달리기 4분 + 걷기 1분 반복. 숨이 편한 속도로",
  race: "10km 도전: 첫 3km는 목표보다 5~10초 느리게, 후반에 올리기",
  race_runwalk: "10km 도전: 달리기 4분 + 걷기 1분 리듬 그대로. 끝까지 유지해도 완주예요",
};

export const CONFIG = {
  id: "10k",
  distanceKm: 10,
  riegelExponent: 1.06,
  finishBuffer: 10,
  tempoOffset: 15,
  easyOffset: [60, 120],
  runWalkFrom: 2400,
  fastUnder: 1320,
  volumeCapRatio: 1.3,
  freqJumpMax: 2,
  paceInputRange: [240, 720],
  t5Range: [840, 3600],
  freqRange: [2, 5],
  tiers: ["basic", "gentle"],
  templates: TEMPLATES,
  sessions: SESSIONS,
  guideText: GUIDE_TEXT,
};
