// 거리 공통 로직: 페이스, 게이트, 티어 선택, 요일 배치, buildPlan, 결과 링크 (SPEC 3~5장, 8.4)
// DOM 없는 순수 함수만 둔다.

export const RECENT_KM = { lt3: 2.5, "3to5": 4, "5to7": 6, gt7: 8 };
export const RECENT_KM_LABEL = { lt3: "3km 미만", "3to5": "3~5km", "5to7": "5~7km", gt7: "7km 이상" };
export const LONG_RUN_DAYS = { sun: 0, sat: 6 };
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const RECENT_FREQ_MAX = 5;

// 5.7 매핑표의 행 순서. guide는 이 순서로 모은다.
const GUIDE_ORDER = ["easy", "interval", "tempo", "sharpen", "final"];
const RUN_WALK_GUIDE = { easy: "runwalk", final: "final_runwalk" };

// ---------- 시간 표기 ----------

const pad2 = (n) => String(n).padStart(2, "0");

// 화면 표시: 1시간 이상이면 h:mm:ss, 아니면 m:ss
export function formatClock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

// 링크·페이스용: 시간 단위 없이 m:ss (분이 60 이상이어도 그대로)
export function formatMinSec(sec) {
  return `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;
}

export const formatPace = formatMinSec;

export function parseMinSec(str) {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(String(str ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function t5FromPace(paceSec) {
  return Math.round(paceSec * 5);
}

// ---------- 입력 검증 ----------

const isInt = (v) => Number.isInteger(v);

export function validateInput(input, config) {
  const errors = [];
  const [tMin, tMax] = config.t5Range;
  const [fMin, fMax] = config.freqRange;
  if (!isInt(input.t5) || input.t5 < tMin || input.t5 > tMax) errors.push("t5");
  if (!isInt(input.recentFreq) || input.recentFreq < 0 || input.recentFreq > RECENT_FREQ_MAX) errors.push("recentFreq");
  if (!Object.hasOwn(RECENT_KM, input.recentKm ?? "")) errors.push("recentKm");
  if (!isInt(input.freq) || input.freq < fMin || input.freq > fMax) errors.push("freq");
  if (!Object.hasOwn(LONG_RUN_DAYS, input.longRunDay ?? "")) errors.push("longRunDay");
  if (input.effort !== "race" && input.effort !== "training") errors.push("effort");
  const target = input.target10 ?? null;
  const [gMin, gMax] = config.targetRange;
  if (target !== null && (!isInt(target) || target < gMin || target > gMax)) errors.push("target10");
  return errors;
}

// ---------- 페이스 (5.2) ----------

// 목표 기록이 예측보다 이 시간보다 빠르면 4주 안에는 무리로 본다
export function targetLimit(t10, config) {
  return Math.ceil(t10 * (1 - config.targetMaxFaster));
}

// target10: 선택 입력한 10km 목표 기록(초). 예측보다 targetMaxFaster 이내로 빠르거나 더 느리면
// 목표를 기준으로 모든 페이스를 계산한다. 런-워크 대상이면 목표를 쓰지 않는다.
export function computePaces(t5, config, target10 = null) {
  const riegel = Math.pow(config.distanceKm / 5, config.riegelExponent);
  const t10 = Math.round(t5 * riegel);
  const runWalk = t5 > config.runWalkFrom;
  const targetApplied = target10 !== null && !runWalk && target10 >= targetLimit(t10, config);
  const base10 = targetApplied ? target10 : t10;
  const p10 = Math.round(base10 / config.distanceKm);
  const p5 = Math.round((targetApplied ? base10 / riegel : t5) / 5);
  const easy = [p10 + config.easyOffset[0], p10 + config.easyOffset[1]];
  const goal = runWalk ? easy[0] : targetApplied ? p10 : p10 + config.finishBuffer;
  let goalTime = null;
  if (!runWalk) goalTime = targetApplied ? target10 : goal * config.distanceKm;
  return {
    runWalk,
    t10,
    targetApplied,
    goalTime,
    pace: { goal, tempo: p10 + config.tempoOffset, interval: p5, easy },
  };
}

// ---------- 게이트 (4장) ----------

export function safetyGate(input) {
  if (input.continuous5k === false) return { type: "gate_5k" };
  if (input.pain === true) return { type: "gate_pain" };
  return null;
}

export function runningGate(input) {
  if (input.recentFreq === 0) return { type: "gate_notRunning" };
  return null;
}

export function baselineKm(input) {
  return input.recentFreq * RECENT_KM[input.recentKm];
}

// ---------- 횟수 조정·티어 (5.3) ----------

export function weekTotal(sessions) {
  return sessions.reduce((sum, [, , km]) => sum + km, 0);
}

export function selectTier(input, config) {
  const B = baselineKm(input);
  const cap = B * config.volumeCapRatio;
  const notices = [];
  let f = input.freq;
  if (f > input.recentFreq + config.freqJumpMax) {
    f = input.recentFreq + config.freqJumpMax;
    notices.push("freq_capped");
  }
  for (let ff = f; ff >= config.freqRange[0]; ff--) {
    const tier = config.tiers.find((t) => cap >= weekTotal(config.templates[t][ff][0]));
    if (tier) {
      if (ff < f) notices.push("freq_reduced");
      return { B, tier, freq: ff, notices };
    }
  }
  return { B, tier: null };
}

// ---------- 요일 배치 (5.6) ----------

// 열 = 앵커 다음 날부터 앵커까지 7일. 오프셋 o인 세션은 열 6 + o.
export function columnsFor(longRunDay) {
  const anchor = LONG_RUN_DAYS[longRunDay];
  return Array.from({ length: 7 }, (_, i) => DAY_NAMES[(anchor + 1 + i) % 7]);
}

function makeCell(sessionId, km, runWalk, config) {
  const s = config.sessions[sessionId];
  const cell = { kind: s.kind, sessionId, cellLabel: s.cellLabel, cellSub: s.cellSub, km };
  if (runWalk) {
    if (s.runWalkSub) {
      cell.kind = "easy";
      cell.cellLabel = "런-워크";
      cell.cellSub = null;
    } else if (s.kind === "easy") {
      cell.cellLabel = "런-워크";
    } else if (s.kind === "long" || s.kind === "final") {
      cell.cellSub = "런-워크";
    }
  }
  return cell;
}

function buildWeeks(tier, freq, runWalk, config) {
  return config.templates[tier][freq].map((sessions, i) => {
    const cells = Array(7).fill(null);
    for (const [offset, sessionId, km] of sessions) {
      cells[6 + offset] = makeCell(sessionId, km, runWalk, config);
    }
    return { week: i + 1, totalKm: weekTotal(sessions), cells };
  });
}

// ---------- 세션 가이드 (5.7, 7.4) ----------

export function guideKeyOf(cell, runWalk, config) {
  let key;
  if (cell.kind === "easy" || cell.kind === "long") key = "easy";
  else if (cell.kind === "final") key = "final";
  else key = config.sessions[cell.sessionId].guideKey;
  return runWalk ? RUN_WALK_GUIDE[key] ?? key : key;
}

function buildGuide(weeks, runWalk, pace, config) {
  const present = new Set();
  for (const w of weeks) for (const c of w.cells) if (c) present.add(guideKeyOf(c, false, config));
  return GUIDE_ORDER.filter((k) => present.has(k)).map((k) => {
    const key = runWalk ? RUN_WALK_GUIDE[k] ?? k : k;
    const text = config.guideText[key]
      .replace("{interval}", formatPace(pace.interval))
      .replace("{tempo}", formatPace(pace.tempo))
      .replace("{raceLo}", formatPace(pace.goal + 5))
      .replace("{raceHi}", formatPace(pace.goal + 10));
    return { key, text };
  });
}

// ---------- buildPlan (4장 흐름 전체) ----------

export function buildPlan(input, config) {
  const safety = safetyGate(input);
  if (safety) return safety;
  // 최근 0회면 1회 거리는 묻지 않으므로 검증보다 먼저 판정한다
  const running = runningGate(input);
  if (running) return running;
  const errors = validateInput(input, config);
  if (errors.length) throw new RangeError(`invalid input: ${errors.join(", ")}`);

  const sel = selectTier(input, config);
  if (!sel.tier) return { type: "gate_volume", B: sel.B };

  const target10 = input.target10 ?? null;
  const { runWalk, t10, targetApplied, goalTime, pace } = computePaces(input.t5, config, target10);
  const notes = [];
  if (input.effort === "training") notes.push("note_training");
  if (input.t5 < config.fastUnder) notes.push("note_fast");
  if (target10 !== null && !runWalk) notes.push(targetApplied ? "note_target" : "note_targetTooFast");

  const weeks = buildWeeks(sel.tier, sel.freq, runWalk, config);
  return {
    type: "plan",
    tier: sel.tier,
    freq: sel.freq,
    requestedFreq: input.freq,
    notices: sel.notices,
    notes,
    runWalk,
    goalShown: !runWalk,
    baselineKm: sel.B,
    t5: input.t5,
    t10,
    goalTime,
    target10: runWalk ? null : target10,
    targetApplied,
    targetLimit: runWalk ? null : targetLimit(t10, config),
    pace,
    longRunDay: input.longRunDay,
    inputMode: input.effort === "training" ? "pace" : "time",
    // 이미지 헤더 기준 줄(7.2)에 필요한 입력값
    recentFreq: input.recentFreq,
    recentKm: input.recentKm,
    adjustNote: sel.freq !== input.freq
      ? `지금 러닝량에 맞춰 주 ${input.freq}회 → ${sel.freq}회로 조정했어요`
      : null,
    columns: columnsFor(input.longRunDay),
    weeks,
    guide: buildGuide(weeks, runWalk, pace, config),
  };
}

// ---------- 결과 링크 (8.4) ----------

// 값이 모두 [0-9a-z:]라 인코딩 없이 이어 붙인다 (8.4 예시와 같은 "t=30:00" 형태)
export function encodeLink(input) {
  return [
    `t=${formatMinSec(input.t5)}`,
    `e=${input.effort}`,
    `rf=${input.recentFreq}`,
    `rk=${input.recentKm}`,
    `f=${input.freq}`,
    `ld=${input.longRunDay}`,
    ...(input.target10 != null ? [`g=${formatMinSec(input.target10)}`] : []),
  ].join("&");
}

const intParam = (v) => (v !== null && /^\d+$/.test(v) ? Number(v) : null);

// 잘못된 파라미터면 null. 링크로 열면 안전 게이트는 통과한 것으로 본다.
export function decodeLink(search, config) {
  const p = new URLSearchParams(search);
  const input = {
    continuous5k: true,
    pain: false,
    t5: parseMinSec(p.get("t")),
    effort: p.get("e"),
    recentFreq: intParam(p.get("rf")),
    recentKm: p.get("rk"),
    freq: intParam(p.get("f")),
    longRunDay: p.get("ld") ?? "sun",
    target10: p.has("g") ? parseMinSec(p.get("g")) ?? -1 : null,
  };
  return validateInput(input, config).length ? null : input;
}
