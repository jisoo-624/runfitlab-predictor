// 렌더 검수 (SPEC 11.4, 개발 전용): 39장 이미지 → reports/images/, 컨택트 시트 → reports/contact-sheet.png
// 실행: node scripts/render-matrix.mjs
// 브라우저: Playwright chromium(npx playwright install chromium). 없으면 설치된 Edge/Chrome을 쓴다.
// overflow가 1개라도 있으면 exit 1. 폰트 로드 실패(시스템 폰트) 상황의 넘침도 함께 검사한다 (7.1).
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "reports");
const IMG = join(OUT, "images");
const ORIGIN = "http://render.local";

const base = {
  continuous5k: true, pain: false, effort: "race", longRunDay: "sun",
  t5: 1800, recentFreq: 3, recentKm: "5to7", freq: 3,
};

// 티어 × 횟수마다 그 결과가 나오는 입력
const TIER_FREQ = {
  "basic-2": { recentFreq: 2, recentKm: "5to7", freq: 2 },
  "basic-3": { recentFreq: 3, recentKm: "5to7", freq: 3 },
  "basic-4": { recentFreq: 4, recentKm: "5to7", freq: 4 },
  "basic-5": { recentFreq: 4, recentKm: "gt7", freq: 5 },
  "gentle-2": { recentFreq: 2, recentKm: "3to5", freq: 2 },
  "gentle-3": { recentFreq: 3, recentKm: "3to5", freq: 3 },
  "gentle-4": { recentFreq: 2, recentKm: "5to7", freq: 4 },
  "gentle-5": { recentFreq: 4, recentKm: "3to5", freq: 5 },
};

const cases = [];
for (const [key, over] of Object.entries(TIER_FREQ)) {
  const [tier, freq] = key.split("-");
  for (const runWalk of [false, true]) {
    for (const ld of ["sun", "sat"]) {
      cases.push({
        name: `${key}-${runWalk ? "runwalk" : "run"}-${ld}`,
        input: { ...base, ...over, t5: runWalk ? 2520 : 1800, longRunDay: ld },
        expect: { tier, freq: Number(freq), runWalk },
      });
    }
  }
}
cases.push(
  { name: "extreme-t5-1400", input: { ...base, t5: 840 } },
  { name: "extreme-t5-3959", input: { ...base, t5: 2399 } },
  { name: "extreme-t5-6000", input: { ...base, t5: 3600 } },
  { name: "header-adjust-G10", input: { ...base, recentFreq: 2, recentKm: "3to5", freq: 5 } },
  { name: "header-pace-G11", input: { ...base, t5: 1950, effort: "training" } },
  { name: "target-applied", input: { ...base, target10: 3660 } },
  { name: "target-too-fast", input: { ...base, target10: 3600 } },
);

const harness = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<script type="module">
import { buildPlan } from "/plan/engine/core.js";
import { CONFIG } from "/plan/engine/plan-10k.js";
import { FALLBACK_FAMILY, layout, prepareFonts, renderPlan } from "/plan/10k/render.js";
const family = await prepareFonts();
const measureCtx = document.createElement("canvas").getContext("2d");
const measure = (f, s) => { measureCtx.font = f; return measureCtx.measureText(s).width; };
window.renderCase = (input) => {
  const plan = buildPlan(input, CONFIG);
  const canvas = document.createElement("canvas");
  const lay = renderPlan(plan, canvas, family);
  const fallback = layout(plan, measure, { family: FALLBACK_FAMILY }).overflow;
  return { plan: { type: plan.type, tier: plan.tier, freq: plan.freq, runWalk: plan.runWalk },
           data: canvas.toDataURL("image/png"), overflow: lay.overflow, fallback };
};
window.contactSheet = async (items, cols) => {
  const tw = 270, th = 480, pad = 16, labelH = 28;
  const rows = Math.ceil(items.length / cols);
  const c = document.createElement("canvas");
  c.width = cols * (tw + pad) + pad;
  c.height = rows * (th + labelH + pad) + pad;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#F3F4F2";
  ctx.fillRect(0, 0, c.width, c.height);
  for (const [i, it] of items.entries()) {
    const img = new Image();
    img.src = it.data;
    await img.decode();
    const x = pad + (i % cols) * (tw + pad);
    const y = pad + Math.floor(i / cols) * (th + labelH + pad);
    ctx.fillStyle = "#23262B";
    ctx.font = "600 15px " + family;
    ctx.fillText(it.name, x, y + 18);
    ctx.drawImage(img, x, y + labelH, tw, th);
  }
  return c.toDataURL("image/png");
};
window.fontFamily = family;
window.ready = true;
</script>`;

const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };

async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    for (const channel of ["msedge", "chrome"]) {
      try {
        return await chromium.launch({ channel });
      } catch {}
    }
    throw err;
  }
}

const browser = await launch();
const page = await browser.newPage();
await page.route(`${ORIGIN}/**`, (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/") return route.fulfill({ body: harness, contentType: "text/html" });
  const file = join(ROOT, decodeURIComponent(path));
  if (!file.startsWith(ROOT)) return route.abort();
  route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
});
await page.goto(`${ORIGIN}/`);
await page.waitForFunction(() => window.ready, null, { timeout: 20000 });
const family = await page.evaluate(() => window.fontFamily);

mkdirSync(IMG, { recursive: true });
const results = [];
let failures = 0;
for (const c of cases) {
  const r = await page.evaluate((input) => window.renderCase(input), c.input);
  writeFileSync(join(IMG, `${c.name}.png`), Buffer.from(r.data.split(",")[1], "base64"));
  const problems = [];
  if (r.plan.type !== "plan") problems.push(`plan 아님: ${r.plan.type}`);
  if (c.expect && (r.plan.tier !== c.expect.tier || r.plan.freq !== c.expect.freq || r.plan.runWalk !== c.expect.runWalk)) {
    problems.push(`변형 불일치: ${JSON.stringify(r.plan)}`);
  }
  for (const o of r.overflow) problems.push(`overflow ${o.id} "${o.text}" ${o.width}>${o.maxWidth}px @${o.size}px`);
  for (const o of r.fallback) problems.push(`overflow(시스템 폰트) ${o.id} "${o.text}" ${o.width}>${o.maxWidth}px @${o.size}px`);
  if (problems.length) failures++;
  results.push({ name: c.name, data: r.data, problems });
  console.log(`${problems.length ? "✗" : "✓"} ${c.name}${problems.map((p) => `\n    ${p}`).join("")}`);
}

const sheet = await page.evaluate(
  ([items, cols]) => window.contactSheet(items, cols),
  [results.map(({ name, data }) => ({ name, data })), 8],
);
writeFileSync(join(OUT, "contact-sheet.png"), Buffer.from(sheet.split(",")[1], "base64"));
await browser.close();

console.log(`\n폰트: ${family.startsWith("Pretendard") ? "Pretendard" : "시스템 폰트 (Pretendard 로드 실패)"}`);
console.log(`${results.length}장, 실패 ${failures}장 → reports/images/, reports/contact-sheet.png`);
if (!family.startsWith("Pretendard")) {
  console.error("Pretendard를 불러오지 못했습니다. 네트워크를 확인하세요.");
  process.exit(1);
}
if (failures) process.exit(1);
