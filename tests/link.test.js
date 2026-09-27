import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, decodeLink, encodeLink } from "../plan/engine/core.js";
import { CONFIG } from "../plan/engine/plan-10k.js";

const g1 = {
  continuous5k: true, pain: false, effort: "race", longRunDay: "sun",
  t5: 1800, recentFreq: 3, recentKm: "5to7", freq: 3, target10: null,
};

test("8.4 예시 형식", () => {
  assert.equal(encodeLink(g1), "t=30:00&e=race&rf=3&rk=5to7&f=3&ld=sun");
  assert.deepEqual(decodeLink("t=30:00&e=race&rf=3&rk=5to7&f=3&ld=sun", CONFIG), g1);
});

test("왕복: 입력 → 링크 → 입력 → 같은 plan", () => {
  const cases = [
    g1,
    { ...g1, t5: 1950, effort: "training" },
    { ...g1, t5: 3600, longRunDay: "sat", recentFreq: 5, recentKm: "gt7", freq: 5 },
    { ...g1, t5: 840, recentKm: "lt3", freq: 2 },
    { ...g1, target10: 3660 },
    { ...g1, target10: 3540 },
  ];
  for (const input of cases) {
    const back = decodeLink(encodeLink(input), CONFIG);
    assert.deepEqual(back, input);
    assert.deepEqual(buildPlan(back, CONFIG), buildPlan(input, CONFIG));
  }
});

test("t는 항상 m:ss (60:00 허용)", () => {
  assert.match(encodeLink({ ...g1, t5: 3600 }), /t=60:00/);
  assert.equal(decodeLink("t=60:00&e=race&rf=3&rk=5to7&f=3", CONFIG).t5, 3600);
});

test("1km 페이스 입력은 t5 + e=training", () => {
  const d = decodeLink("t=32:30&e=training&rf=3&rk=5to7&f=3&ld=sun", CONFIG);
  assert.equal(d.t5, 1950);
  assert.equal(buildPlan(d, CONFIG).inputMode, "pace");
});

test("목표 기록은 g=m:ss (선택)", () => {
  assert.equal(encodeLink({ ...g1, target10: 3660 }), "t=30:00&e=race&rf=3&rk=5to7&f=3&ld=sun&g=61:00");
  assert.equal(decodeLink("t=30:00&e=race&rf=3&rk=5to7&f=3&g=61:00", CONFIG).target10, 3660);
  assert.equal(decodeLink("t=30:00&e=race&rf=3&rk=5to7&f=3", CONFIG).target10, null);
});

test("ld 없으면 sun", () => {
  assert.equal(decodeLink("t=30:00&e=race&rf=3&rk=5to7&f=3", CONFIG).longRunDay, "sun");
});

test("알 수 없는 파라미터는 무시", () => {
  assert.deepEqual(decodeLink("t=30:00&e=race&rf=3&rk=5to7&f=3&ld=sun&utm_source=x&foo=1", CONFIG), g1);
});

test("잘못된 파라미터는 null", () => {
  const bad = [
    "",
    "t=13:59&e=race&rf=3&rk=5to7&f=3",   // t5 < 840
    "t=60:01&e=race&rf=3&rk=5to7&f=3",   // t5 > 3600
    "t=1:00:00&e=race&rf=3&rk=5to7&f=3", // h:mm:ss 형식 아님
    "t=30:0&e=race&rf=3&rk=5to7&f=3",
    "t=30:00&e=fast&rf=3&rk=5to7&f=3",
    "t=30:00&rf=3&rk=5to7&f=3",          // e 없음
    "t=30:00&e=race&rf=6&rk=5to7&f=3",
    "t=30:00&e=race&rf=-1&rk=5to7&f=3",
    "t=30:00&e=race&rf=3&rk=9km&f=3",
    "t=30:00&e=race&rf=3&rk=5to7&f=1",
    "t=30:00&e=race&rf=3&rk=5to7&f=3.5",
    "t=30:00&e=race&rf=3&rk=5to7&f=3&ld=mon",
    "t=30:00&e=race&rf=3&rk=5to7&f=3&g=abc",
    "t=30:00&e=race&rf=3&rk=5to7&f=3&g=19:59",   // 목표 < 20:00
    "t=30:00&e=race&rf=3&rk=5to7&f=3&g=120:01",  // 목표 > 2:00:00
  ];
  for (const q of bad) assert.equal(decodeLink(q, CONFIG), null, q);
});

test("t5 범위는 effort와 무관하게 840~3600", () => {
  // 1km 페이스 입력 범위(4:00~12:00 → 20:00~60:00) 밖이라도 840 이상이면 통과
  assert.equal(decodeLink("t=15:00&e=training&rf=3&rk=5to7&f=3", CONFIG).t5, 900);
});
