import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, formatClock, formatPace, parseMinSec, t5FromPace } from "../plan/engine/core.js";
import { CONFIG } from "../plan/engine/plan-10k.js";

const base = {
  continuous5k: true, pain: false, effort: "race", longRunDay: "sun",
  t5: 1800, recentFreq: 3, recentKm: "5to7", freq: 3,
};
const plan = (over) => buildPlan({ ...base, ...over }, CONFIG);
const totals = (p) => p.weeks.map((w) => w.totalKm);
const paceStr = (p) => ({
  goal: formatPace(p.pace.goal),
  easy: p.pace.easy.map(formatPace).join("~"),
  tempo: formatPace(p.pace.tempo),
  interval: formatPace(p.pace.interval),
});

// ---------- 11.1 골든 케이스 ----------

test("G1: 30:00, rf3, 5to7, f3", () => {
  const p = plan({});
  assert.equal(p.type, "plan");
  assert.equal(p.tier, "basic");
  assert.equal(p.freq, 3);
  assert.equal(p.baselineKm, 18);
  assert.equal(formatClock(p.t10), "1:02:33");
  assert.equal(formatClock(p.goalTime), "1:04:10");
  assert.deepEqual(paceStr(p), { goal: "6:25", easy: "7:15~8:15", tempo: "6:30", interval: "6:00" });
  assert.deepEqual(p.columns, ["월", "화", "수", "목", "금", "토", "일"]);
  assert.deepEqual(p.notices, []);
  assert.deepEqual(p.notes, []);
  assert.equal(p.adjustNote, null);
  assert.equal(p.goalShown, true);
  assert.equal(p.inputMode, "time");
  assert.deepEqual(p.guide.map((g) => g.key), ["easy", "interval", "tempo", "sharpen", "final"]);
  assert.equal(p.targetApplied, false);
  assert.equal(p.target10, null);
  assert.match(p.guide[1].text, /400m를 6:00\/km로/);
  assert.match(p.guide[2].text, /6:30\/km로/);
});

test("G1 캘린더", () => {
  const p = plan({});
  const row = (w) => w.cells.map((c) => (c ? `${c.cellLabel}${c.km}${c.cellSub ? `(${c.cellSub})` : ""}` : "·")).join(" ");
  assert.deepEqual(p.weeks.map((w) => `${w.week}주 ${w.totalKm}km : ${row(w)}`), [
    "1주 16km : · 이지런5 · 인터벌5(400m×5) · · 롱런6",
    "2주 17.5km : · 이지런5 · 템포런5(2.5km) · · 롱런7.5",
    "3주 18.5km : · 이지런5 · 인터벌5(400m×6) · · 롱런8.5",
    "4주 17km : · 이지런4 · 가속주3(100m×4) · · 롱런10",
  ]);
  assert.deepEqual(p.weeks[0].cells.map((c) => c?.kind ?? null), [null, "easy", null, "quality", null, null, "long"]);
  assert.equal(p.weeks[3].cells[6].kind, "final");
  assert.equal(p.weeks[3].cells[6].cellSub, null);
});

test("G2: gentle 주3", () => {
  const p = plan({ recentKm: "3to5" });
  assert.equal(p.tier, "gentle");
  assert.equal(p.freq, 3);
  assert.equal(p.baselineKm, 12);
  assert.deepEqual(totals(p), [13, 14.5, 15.5, 16]);
});

test("G3: gate_volume B 4", () => {
  assert.deepEqual(plan({ recentFreq: 1, recentKm: "3to5", freq: 4 }), { type: "gate_volume", B: 4 });
});

test("G4: 42:00 런-워크", () => {
  const p = plan({ t5: 2520 });
  assert.equal(p.tier, "basic");
  assert.equal(p.runWalk, true);
  assert.equal(p.goalShown, false);
  assert.equal(p.goalTime, null);
  assert.equal(formatClock(p.t10), "1:27:34");
  assert.equal(paceStr(p).easy, "9:45~10:45");
  assert.equal(formatPace(p.pace.goal), "9:45");
  const thu = p.weeks.map((w) => w.cells[3]);
  for (const [i, id] of ["int5", "tempo5", "int6"].entries()) {
    assert.deepEqual(thu[i], { kind: "easy", sessionId: id, cellLabel: "런-워크", cellSub: null, km: 5 });
  }
  assert.equal(thu[3].sessionId, "sharpen");
  assert.equal(thu[3].kind, "quality");
  assert.equal(thu[3].cellLabel, "가속주");
  // 일반 이지·롱런 표기 (5.5)
  assert.equal(p.weeks[0].cells[1].cellLabel, "런-워크");
  assert.equal(p.weeks[0].cells[1].kind, "easy");
  assert.deepEqual(p.weeks[0].cells[6], { kind: "long", sessionId: "long", cellLabel: "롱런", cellSub: "런-워크", km: 6 });
  assert.deepEqual(p.weeks[3].cells[6], { kind: "final", sessionId: "final", cellLabel: "롱런", cellSub: "런-워크", km: 10 });
  assert.deepEqual(p.guide.map((g) => g.key), ["runwalk", "sharpen", "final_runwalk"]);
});

test("G5: 21:00 주5 note_fast", () => {
  const p = plan({ t5: 1260, recentFreq: 4, recentKm: "gt7", freq: 5 });
  assert.equal(p.tier, "basic");
  assert.equal(p.freq, 5);
  assert.deepEqual(p.notes, ["note_fast"]);
  assert.equal(formatClock(p.t10), "43:47");
  assert.equal(formatClock(p.goalTime), "45:30");
  assert.deepEqual(paceStr(p), { goal: "4:33", easy: "5:23~6:23", tempo: "4:38", interval: "4:12" });
  assert.deepEqual(totals(p), [23, 25.5, 27.5, 20]);
});

test("G6: gate_5k", () => assert.deepEqual(plan({ continuous5k: false }), { type: "gate_5k" }));
test("G7: gate_pain", () => assert.deepEqual(plan({ pain: true }), { type: "gate_pain" }));
test("G8: gate_notRunning", () =>
  assert.deepEqual(plan({ recentFreq: 0, recentKm: "3to5" }), { type: "gate_notRunning" }));

test("최근 0회면 1회 거리가 없어도 gate_notRunning", () =>
  assert.deepEqual(plan({ recentFreq: 0, recentKm: null }), { type: "gate_notRunning" }));

test("G9: 토요일 앵커", () => {
  const p = plan({ recentFreq: 2, freq: 2, longRunDay: "sat" });
  assert.equal(p.tier, "basic");
  assert.equal(p.freq, 2);
  assert.deepEqual(p.columns, ["일", "월", "화", "수", "목", "금", "토"]);
  const w1 = p.weeks[0].cells;
  assert.equal(p.columns[w1.findIndex((c) => c?.sessionId === "easy")], "화");
  assert.equal(w1[2].km, 5);
  assert.equal(p.columns[w1.findIndex((c) => c?.sessionId === "long")], "토");
  assert.equal(w1[6].km, 6);
});

test("G10: 횟수 cap + 감소", () => {
  const p = plan({ recentFreq: 2, recentKm: "3to5", freq: 5 });
  assert.equal(p.tier, "gentle");
  assert.equal(p.freq, 2);
  assert.equal(p.requestedFreq, 5);
  assert.deepEqual(p.notices, ["freq_capped", "freq_reduced"]);
  assert.deepEqual(totals(p), [9.5, 10.5, 11.5, 13]);
  assert.equal(p.adjustNote, "지금 러닝량에 맞춰 주 5회 → 2회로 조정했어요");
});

test("G11: 1km 페이스 6:30 입력", () => {
  const t5 = t5FromPace(parseMinSec("6:30"));
  assert.equal(formatClock(t5), "32:30");
  const p = plan({ t5, effort: "training" });
  assert.equal(p.tier, "basic");
  assert.deepEqual(p.notes, ["note_training"]);
  assert.equal(p.inputMode, "pace");
  assert.equal(formatClock(p.t10), "1:07:46");
  assert.equal(formatClock(p.goalTime), "1:09:30");
  assert.deepEqual(paceStr(p), { goal: "6:57", easy: "7:47~8:47", tempo: "7:02", interval: "6:30" });
});

// ---------- 목표 기록 (예측보다 최대 5% 빠른 것까지) ----------

test("목표 기록: 허용 범위 안이면 목표 기준 페이스", () => {
  // G1 예측 1:02:33(3753초) → 한계 ceil(3753 × 0.95) = 3566초(59:26)
  const p = plan({ target10: 3660 }); // 1:01:00
  assert.equal(p.targetApplied, true);
  assert.equal(p.targetLimit, 3566);
  assert.deepEqual(p.notes, ["note_target"]);
  assert.equal(formatClock(p.goalTime), "1:01:00");
  assert.equal(formatClock(p.t10), "1:02:33"); // 예측은 그대로
  // p10 = 366, 인터벌 = round(3660 / 2^1.06 / 5) = 351
  assert.deepEqual(paceStr(p), { goal: "6:06", easy: "7:06~8:06", tempo: "6:21", interval: "5:51" });
  assert.equal(p.tier, "basic"); // 템플릿·볼륨은 목표와 무관
  assert.deepEqual(totals(p), [16, 17.5, 18.5, 17]);
});

test("목표 기록: 한계와 같으면 반영", () => {
  assert.equal(plan({ target10: 3566 }).targetApplied, true);
  assert.equal(plan({ target10: 3565 }).targetApplied, false);
  // 이전 기준(3%)에서는 막혔던 1:00:00도 이제 반영
  assert.equal(plan({ target10: 3600 }).targetApplied, true);
});

test("목표 기록: 너무 빠르면 예측 기준 + 안내", () => {
  const p = plan({ target10: 3540 }); // 59:00
  assert.equal(p.targetApplied, false);
  assert.equal(p.target10, 3540);
  assert.deepEqual(p.notes, ["note_targetTooFast"]);
  assert.equal(formatClock(p.goalTime), "1:04:10");
  assert.deepEqual(paceStr(p), { goal: "6:25", easy: "7:15~8:15", tempo: "6:30", interval: "6:00" });
});

test("목표 기록: 예측보다 느리면 목표 기준 (더 편한 페이스)", () => {
  const p = plan({ target10: 4200 }); // 1:10:00
  assert.equal(p.targetApplied, true);
  assert.deepEqual(paceStr(p), { goal: "7:00", easy: "8:00~9:00", tempo: "7:15", interval: "6:43" });
});

test("목표 기록: 런-워크 대상이면 무시", () => {
  const p = plan({ t5: 2520, target10: 5400 });
  assert.equal(p.targetApplied, false);
  assert.equal(p.target10, null);
  assert.equal(p.goalTime, null);
  assert.deepEqual(p.notes, []);
});

test("목표 기록: 범위 밖이면 예외", () => {
  assert.throws(() => plan({ target10: 1199 }), RangeError);
  assert.throws(() => plan({ target10: 7201 }), RangeError);
});

// ---------- 템플릿 합계 (5.4 표의 합계 열) ----------

test("템플릿 주간 합계가 5.4 표와 일치", () => {
  const expected = {
    basic: { 2: [11, 12.5, 13.5, 13], 3: [16, 17.5, 18.5, 17], 4: [19, 20.5, 22.5, 20], 5: [23, 25.5, 27.5, 20] },
    gentle: { 2: [9.5, 10.5, 11.5, 13], 3: [13, 14.5, 15.5, 16], 4: [15, 17, 18.5, 19], 5: [18, 20, 22, 19] },
  };
  for (const tier of ["basic", "gentle"]) {
    for (const f of [2, 3, 4, 5]) {
      const sums = CONFIG.templates[tier][f].map((w) => w.reduce((s, [, , km]) => s + km, 0));
      assert.deepEqual(sums, expected[tier][f], `${tier} ${f}`);
    }
  }
});

// ---------- 11.2 불변식 (전수 480 × 롱런 요일 2) ----------

const T5S = [1260, 1500, 1800, 2100, 2520];
const RKS = ["lt3", "3to5", "5to7", "gt7"];
const RK_KM = { lt3: 2.5, "3to5": 4, "5to7": 6, gt7: 8 };

function* allInputs() {
  for (const t5 of T5S) for (let rf = 0; rf <= 5; rf++) for (const rk of RKS) for (let f = 2; f <= 5; f++) {
    for (const ld of ["sun", "sat"]) yield { ...base, t5, recentFreq: rf, recentKm: rk, freq: f, longRunDay: ld };
  }
}

const isHard = (id) => /^(int|tempo)\d$/.test(id);
const partsSum = (id) => CONFIG.sessions[id].parts.reduce((s, [, km]) => s + km, 0);
const near = (a, b) => Math.abs(a - b) < 1e-9;

// 5.7 매핑표를 테스트 쪽에서 따로 구현
function expectedGuide(p) {
  const rows = [
    [(c) => c.kind === "easy" || c.kind === "long", "easy", "runwalk"],
    [(c) => c.kind === "quality" && /^int/.test(c.sessionId), "interval", null],
    [(c) => c.kind === "quality" && /^tempo/.test(c.sessionId), "tempo", null],
    [(c) => c.kind === "quality" && c.sessionId === "sharpen", "sharpen", "sharpen"],
    [(c) => c.kind === "final", "final", "final_runwalk"],
  ];
  const cells = p.weeks.flatMap((w) => w.cells.filter(Boolean));
  return rows.filter(([match]) => cells.some(match)).map(([, normal, rw]) => (p.runWalk ? rw : normal));
}

test("불변식 1~11 (960 조합)", () => {
  let plans = 0;
  for (const input of allInputs()) {
    const p = buildPlan(input, CONFIG);
    if (p.type !== "plan") continue;
    plans++;
    const tag = JSON.stringify(input);
    const B = input.recentFreq * RK_KM[input.recentKm];
    const flat = p.weeks.flatMap((w) => w.cells);

    // 1
    for (const w of p.weeks) assert.ok(near(w.totalKm, w.cells.reduce((s, c) => s + (c ? c.km : 0), 0)), `1 ${tag}`);
    // 2
    assert.ok(p.weeks[0].totalKm <= B * 1.3 + 1e-9, `2 ${tag}`);
    // 3
    for (const i of [0, 1]) assert.ok(p.weeks[i + 1].totalKm / p.weeks[i].totalKm - 1 <= 0.15 + 1e-9, `3 ${tag}`);
    // 4
    const w4 = p.weeks[3].cells.reduce((s, c) => s + (c && c.kind !== "final" ? c.km : 0), 0);
    assert.ok(w4 <= p.weeks[2].totalKm * 0.6 + 1e-9, `4 ${tag}`);
    // 5 (sessionId 기준, 주 경계 포함)
    flat.forEach((c, i) => {
      const next = flat[i + 1];
      if (c && isHard(c.sessionId) && next) {
        assert.ok(!isHard(next.sessionId) && next.sessionId !== "long", `5 ${tag}`);
      }
    });
    // 6
    p.weeks.forEach((w, i) => {
      assert.equal(w.cells[6]?.kind, i === 3 ? "final" : "long", `6 ${tag}`);
    });
    assert.equal(flat.filter((c) => c?.kind === "final").length, 1, `6 final ${tag}`);
    assert.equal(p.weeks[3].cells[6].km, 10, `6 final 10km ${tag}`);
    // 7
    const longs = p.weeks.slice(0, 3).map((w) => w.cells[6].km);
    assert.ok(longs[0] < longs[1] && longs[1] < longs[2], `7 ${tag}`);
    // 8
    for (const c of flat) if (c && isHard(c.sessionId)) assert.ok(near(partsSum(c.sessionId), c.km), `8 ${tag}`);
    // 9
    assert.ok(p.freq <= input.recentFreq + 2 && p.freq <= p.requestedFreq, `9 ${tag}`);
    // 10
    assert.deepEqual(p.guide.map((g) => g.key), expectedGuide(p), `10 ${tag}`);
    // 11
    if (!p.goalShown) assert.equal(p.goalTime, null, `11 ${tag}`);
    // 부가: kind 4종, 런-워크 표기
    for (const c of flat) {
      if (!c) continue;
      assert.ok(["easy", "quality", "long", "final"].includes(c.kind), `kind ${tag}`);
      if (p.runWalk && c.kind === "easy") assert.equal(c.cellLabel, "런-워크", `rw label ${tag}`);
      if (p.runWalk) assert.ok(!(c.kind === "quality" && isHard(c.sessionId)), `rw sub ${tag}`);
    }
  }
  assert.equal(plans, 320 * 2);
});

// ---------- 11.3 분포 ----------

test("전수 분포와 최대 주간 증가율", () => {
  const dist = {};
  let maxInc = 0;
  for (const input of allInputs()) {
    if (input.longRunDay !== "sun") continue;
    const p = buildPlan(input, CONFIG);
    const key = p.type === "plan" ? p.tier : p.type;
    dist[key] = (dist[key] ?? 0) + 1;
    if (p.type === "plan") {
      for (const i of [0, 1]) maxInc = Math.max(maxInc, p.weeks[i + 1].totalKm / p.weeks[i].totalKm - 1);
    }
  }
  assert.deepEqual(dist, { gate_notRunning: 80, gate_volume: 80, gentle: 120, basic: 200 });
  assert.equal((maxInc * 100).toFixed(1), "13.6");
});

// ---------- 입력 범위 ----------

test("범위 밖 입력은 예외", () => {
  assert.throws(() => plan({ t5: 839 }), RangeError);
  assert.throws(() => plan({ t5: 3601 }), RangeError);
  assert.throws(() => plan({ freq: 6 }), RangeError);
  assert.throws(() => plan({ recentKm: "toString" }), RangeError);
  assert.doesNotThrow(() => plan({ t5: 840 }));
  assert.doesNotThrow(() => plan({ t5: 3600 }));
});

test("시간 표기", () => {
  assert.equal(formatClock(3600), "1:00:00");
  assert.equal(formatClock(2399), "39:59");
  assert.equal(parseMinSec("60:00"), 3600);
  assert.equal(parseMinSec("6:60"), null);
});
