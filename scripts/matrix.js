// 480 조합 전수 결과표 (SPEC 11.3) → reports/matrix-10k.md, reports/matrix-10k.csv
// 실행: node scripts/matrix.js  (기대 분포·최대 증가율과 다르면 exit 1)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, formatClock, formatPace } from "../plan/engine/core.js";
import { CONFIG } from "../plan/engine/plan-10k.js";

const T5S = [1260, 1500, 1800, 2100, 2520];
const RFS = [0, 1, 2, 3, 4, 5];
const RKS = ["lt3", "3to5", "5to7", "gt7"];
const FS = [2, 3, 4, 5];
const EXPECTED = { gate_notRunning: 80, gate_volume: 80, gentle: 120, basic: 200 };
const EXPECTED_MAX_INC = "13.6";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "reports");

const rows = [];
const dist = {};
let maxInc = { value: 0, row: null };

for (const t5 of T5S) for (const rf of RFS) for (const rk of RKS) for (const f of FS) {
  const input = {
    continuous5k: true, pain: false, effort: "race", longRunDay: "sun",
    t5, recentFreq: rf, recentKm: rk, freq: f,
  };
  const p = buildPlan(input, CONFIG);
  const result = p.type === "plan" ? p.tier : p.type;
  dist[result] = (dist[result] ?? 0) + 1;

  const row = {
    t5: formatClock(t5), rf, rk, f, result,
    B: p.type === "plan" ? p.baselineKm : p.B ?? "",
    freq: "", notices: "", notes: "", runWalk: "", goal: "", weeks: "", inc: "",
  };
  if (p.type === "plan") {
    const totals = p.weeks.map((w) => w.totalKm);
    const incs = [0, 1].map((i) => totals[i + 1] / totals[i] - 1);
    const inc = Math.max(...incs);
    if (inc > maxInc.value) maxInc = { value: inc, row };
    Object.assign(row, {
      freq: p.freq,
      notices: p.notices.join(" "),
      notes: p.notes.join(" "),
      runWalk: p.runWalk ? "Y" : "",
      goal: p.goalShown ? `${formatClock(p.goalTime)} (${formatPace(p.pace.goal)})` : `런-워크 ${formatPace(p.pace.goal)}`,
      weeks: totals.join(" / "),
      inc: `${(inc * 100).toFixed(1)}%`,
    });
  }
  rows.push(row);
}

const COLS = [
  ["t5", "t5"], ["rf", "rf"], ["rk", "rk"], ["f", "f"], ["result", "결과"], ["B", "B(km)"],
  ["freq", "최종 주"], ["notices", "notices"], ["notes", "notes"], ["runWalk", "런-워크"],
  ["goal", "완주 목표"], ["weeks", "주간 km"], ["inc", "최대 증가"],
];

const csv = [COLS.map(([, h]) => h).join(",")]
  .concat(rows.map((r) => COLS.map(([k]) => {
    const v = String(r[k]);
    return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")))
  .join("\n") + "\n";

const maxIncStr = (maxInc.value * 100).toFixed(1);
const distOk = Object.entries(EXPECTED).every(([k, v]) => dist[k] === v) && Object.keys(dist).length === 4;
const incOk = maxIncStr === EXPECTED_MAX_INC;

const md = [
  "# 10K 루틴 전수 결과표",
  "",
  "`node scripts/matrix.js`로 생성. t5 5종 × rf 6종 × rk 4종 × f 4종 = 480 조합, 롱런 요일 일요일, 5km 기록 입력(race).",
  "",
  "## 요약",
  "",
  "| 결과 | 개수 | 기대 |",
  "|---|---|---|",
  ...Object.keys(EXPECTED).map((k) => `| ${k} | ${dist[k] ?? 0} | ${EXPECTED[k]} |`),
  "",
  `- 분포 일치: ${distOk ? "예" : "아니오"}`,
  `- 최대 주간 증가율: ${maxIncStr}% (기대 ${EXPECTED_MAX_INC}%, ${incOk ? "일치" : "불일치"}) — 첫 사례 t5 ${maxInc.row.t5}, rf ${maxInc.row.rf}, rk ${maxInc.row.rk}, f ${maxInc.row.f}`,
  "",
  "## 전체",
  "",
  `| ${COLS.map(([, h]) => h).join(" | ")} |`,
  `|${COLS.map(() => "---").join("|")}|`,
  ...rows.map((r) => `| ${COLS.map(([k]) => r[k]).join(" | ")} |`),
  "",
].join("\n");

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "matrix-10k.csv"), csv);
writeFileSync(join(outDir, "matrix-10k.md"), md);

console.log("분포:", dist);
console.log(`최대 주간 증가율: ${maxIncStr}%`);
if (!distOk || !incOk) {
  console.error("기대값과 다릅니다 (SPEC 11.3)");
  process.exit(1);
}
console.log("OK → reports/matrix-10k.md, reports/matrix-10k.csv");
