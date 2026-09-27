// 4주 루틴 이미지 (SPEC 7장)
// layout(plan, measure, opts): 그리기 목록 + overflow 목록을 반환. 글자 폭 측정은 주입받는다.
// draw(ctx, layout): 목록대로 canvas에 그린다.
import { RECENT_KM_LABEL, formatClock, formatPace } from "../engine/core.js";

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FONT_FAMILY = "Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
export const FALLBACK_FAMILY = "-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

const C = {
  bg: "#23262B",
  white: "#FFFFFF",
  sub: "#B5B8BE",
  dim: "#7C8088",
  orange: "#FF5A1F",
  easyFill: "#34373D",
  charcoal: "#23262B",
  restLine: "#3A3D43",
};

const L = 60;
const R = WIDTH - 60;
const CONTENT_W = R - L;

// 캘린더 치수 (7.3)
const CAL = {
  headerY: 716,      // 요일 헤더 baseline
  top: 740,          // 첫 행 y
  rowH: 150,
  rowGap: 14,
  labelW: 100,
  colGap: 6,
  cellPad: 6,
};
CAL.colW = (CONTENT_W - CAL.labelW - CAL.colGap * 6) / 7;

// ---------- 헤더 문구 (7.2) ----------

export function basisLine(plan) {
  const first = plan.inputMode === "pace"
    ? `1km ${formatPace(Math.round(plan.t5 / 5))}`
    : `5km ${formatClock(plan.t5)}`;
  const recent = `평소 주 ${plan.recentFreq}회${plan.recentFreq >= 5 ? " 이상" : ""}, ${RECENT_KM_LABEL[plan.recentKm]}`;
  return `${first} · ${recent} · 주 ${plan.freq}회 훈련`;
}

export function fileName(plan) {
  const mm = Math.floor(plan.t5 / 60);
  const ss = String(plan.t5 % 60).padStart(2, "0");
  return `runfitlab-10k-4weeks-${mm}${ss}-${plan.freq}x.png`;
}

export function altText(plan) {
  const ladder = plan.weeks.slice(0, 3).map((w) => w.cells[6].km).join("→") + "km";
  const goal = plan.goalShown ? `${goalLabel(plan)} ${formatClock(plan.goalTime)}` : "완주 목표: 걷기를 섞어도 완주";
  return `4주 루틴 이미지: 주 ${plan.freq}회, 롱런 ${ladder}, ${goal}`;
}

export function goalLabel(plan) {
  return plan.targetApplied ? "10km 목표 기록" : "10km 예상 기록";
}

// ---------- layout ----------

export function layout(plan, measure, opts = {}) {
  const family = opts.family ?? FONT_FAMILY;
  const ops = [];
  const overflow = [];
  const font = (weight, size) => `${weight} ${size}px ${family}`;

  // 최대 폭 안에 들어갈 때까지 1px씩 줄인다. 최소 크기로도 넘치면 overflow에 기록 (7.5)
  function fit(runs, weight, size, minSize, maxWidth, id) {
    let s = size;
    const widthAt = (px) => runs.reduce((sum, r) => sum + measure(font(r.weight ?? weight, px), r.text), 0);
    let w = widthAt(s);
    while (w > maxWidth && s > minSize) w = widthAt(--s);
    if (w > maxWidth) overflow.push({ id, text: runs.map((r) => r.text).join(""), width: Math.ceil(w), maxWidth: Math.floor(maxWidth), size: s });
    return { size: s, width: w, widthAt };
  }

  // 한 줄 텍스트. runs = [{ text, color, weight? }], align = left | center | right
  function text(id, runs, { x, y, weight, size, minSize = size, maxWidth, align = "left" }) {
    if (typeof runs === "string") runs = [{ text: runs }];
    const f = fit(runs, weight, size, minSize, maxWidth, id);
    let cx = align === "left" ? x : align === "right" ? x - f.width : x - f.width / 2;
    for (const r of runs) {
      const rf = font(r.weight ?? weight, f.size);
      ops.push({ type: "text", id, text: r.text, x: cx, y, font: rf, color: r.color });
      cx += measure(rf, r.text);
    }
  }

  const rect = (x, y, w, h, r, style) => ops.push({ type: "rect", x, y, w, h, r, ...style });

  rect(0, 0, WIDTH, HEIGHT, 0, { fill: C.bg });

  // ① 헤더 (120~400)
  ops.push({ type: "circle", x: L + 10, y: 160, r: 10, fill: C.orange });
  text("brand", [{ text: "런핏랩", color: C.white }], { x: L + 32, y: 171, weight: 700, size: 30, maxWidth: 400 });
  text("title", [{ text: "10km 완주 4주 루틴", color: C.white }], { x: L, y: 262, weight: 800, size: 72, minSize: 56, maxWidth: CONTENT_W });
  text("basis", [{ text: basisLine(plan), color: C.sub }], { x: L, y: 322, weight: 400, size: 30, minSize: 24, maxWidth: CONTENT_W });
  if (plan.adjustNote) {
    text("adjust", [{ text: plan.adjustNote, color: C.orange }], { x: L, y: 372, weight: 700, size: 28, minSize: 22, maxWidth: CONTENT_W });
  }

  // ② 목표 (400~540)
  if (plan.goalShown) {
    text("goalLabel", [{ text: goalLabel(plan), color: C.sub }], { x: L, y: 440, weight: 700, size: 28, maxWidth: 400 });
    text("goalTime", [{ text: formatClock(plan.goalTime), color: C.orange }], { x: L, y: 530, weight: 800, size: 96, minSize: 72, maxWidth: 600 });
    text("goalPace", [{ text: `${formatPace(plan.pace.goal)}/km`, color: C.white }], { x: R, y: 530, weight: 700, size: 48, minSize: 36, maxWidth: 340, align: "right" });
  } else {
    text("goalLabel", [{ text: "목표", color: C.sub }], { x: L, y: 440, weight: 700, size: 28, maxWidth: 400 });
    text("goalRunWalk", [{ text: "걷기를 섞어도 끝까지 완주", color: C.orange }], { x: L, y: 515, weight: 800, size: 64, minSize: 44, maxWidth: CONTENT_W });
  }

  // ③ 페이스 (540~680). 루틴에 등장한 세션의 페이스만 보여준다.
  const easyRange = plan.pace.easy.map(formatPace).join("~");
  const guideKeys = new Set(plan.guide.map((g) => g.key));
  const paceBoxes = plan.runWalk
    ? [["이지런·롱런", easyRange], ["런-워크", "달리기 4분·걷기 1분"]]
    : [
      ["이지런·롱런", easyRange],
      guideKeys.has("tempo") && ["템포런", formatPace(plan.pace.tempo)],
      guideKeys.has("interval") && ["인터벌", formatPace(plan.pace.interval)],
    ].filter(Boolean);
  const boxGap = 12;
  const boxW = (CONTENT_W - boxGap * (paceBoxes.length - 1)) / paceBoxes.length;
  paceBoxes.forEach(([label, value], i) => {
    const x = L + i * (boxW + boxGap);
    rect(x, 562, boxW, 110, 14, { fill: C.easyFill });
    text(`paceLabel${i}`, [{ text: label, color: C.sub }], { x: x + boxW / 2, y: 602, weight: 400, size: 24, minSize: 20, maxWidth: boxW - 24, align: "center" });
    text(`paceValue${i}`, [{ text: value, color: C.white }], { x: x + boxW / 2, y: 648, weight: 800, size: 36, minSize: 26, maxWidth: boxW - 24, align: "center" });
  });

  // ④ 캘린더 (680~1400)
  const colX = (i) => L + CAL.labelW + i * (CAL.colW + CAL.colGap);
  plan.columns.forEach((day, i) => {
    text(`day${i}`, [{ text: day, color: C.sub }], { x: colX(i) + CAL.colW / 2, y: CAL.headerY, weight: 700, size: 26, maxWidth: CAL.colW, align: "center" });
  });
  plan.weeks.forEach((wk, r) => {
    const y = CAL.top + r * (CAL.rowH + CAL.rowGap);
    const labelMax = CAL.labelW - 8;
    const labelY = y + 62;
    text(`week${wk.week}`, [{ text: `${wk.week}주`, color: C.white }], { x: L, y: labelY, weight: 800, size: 34, minSize: 28, maxWidth: labelMax });
    text(`weekKm${wk.week}`, [{ text: `${wk.totalKm}km`, color: C.sub }], { x: L, y: labelY + 36, weight: 400, size: 24, minSize: 20, maxWidth: labelMax });

    wk.cells.forEach((cell, i) => {
      const x = colX(i);
      const id = `w${wk.week}c${i}`;
      if (!cell) {
        rect(x + 1, y + 1, CAL.colW - 2, CAL.rowH - 2, 12, { stroke: C.restLine, lineWidth: 2 });
        return;
      }
      let fg = C.white;
      let subColor = C.sub;
      if (cell.kind === "easy") rect(x, y, CAL.colW, CAL.rowH, 12, { fill: C.easyFill });
      else if (cell.kind === "quality") { rect(x, y, CAL.colW, CAL.rowH, 12, { fill: C.white }); fg = C.charcoal; subColor = "#5C6068"; }
      else if (cell.kind === "long") rect(x + 1, y + 1, CAL.colW - 2, CAL.rowH - 2, 12, { stroke: C.orange, lineWidth: 2 });
      else if (cell.kind === "final") { rect(x, y, CAL.colW, CAL.rowH, 12, { fill: C.orange }); subColor = C.white; }

      const cx = x + CAL.colW / 2;
      const maxW = CAL.colW - CAL.cellPad * 2;
      const top = cell.cellSub ? y + 46 : y + 62;
      text(`${id}.label`, [{ text: cell.cellLabel, color: fg }], { x: cx, y: top, weight: 800, size: 30, minSize: 26, maxWidth: maxW, align: "center" });
      text(`${id}.km`, [{ text: `${cell.km}km`, color: fg }], { x: cx, y: top + 40, weight: 700, size: 30, minSize: 26, maxWidth: maxW, align: "center" });
      if (cell.cellSub) {
        text(`${id}.sub`, [{ text: cell.cellSub, color: subColor }], { x: cx, y: top + 80, weight: 400, size: 22, minSize: 20, maxWidth: maxW, align: "center" });
      }
    });
  });

  // ⑤ 세션 가이드 (1400~1600)
  const guideTop = 1446;
  const guideStep = Math.min(40, 180 / Math.max(plan.guide.length, 1));
  plan.guide.forEach((g, i) => {
    const colon = g.text.indexOf(":");
    const runs = [
      { text: g.text.slice(0, colon + 1), color: C.white, weight: 700 },
      { text: g.text.slice(colon + 1), color: C.sub },
    ];
    text(`guide.${g.key}`, runs, { x: L, y: guideTop + i * guideStep, weight: 400, size: 26, minSize: 24, maxWidth: CONTENT_W });
  });

  // ⑥ 규칙 (1600~1700)
  ["강도 훈련 다음 날은 쉬거나 이지런", "빠진 날은 몰아서 하지 않기", "통증이 이틀 넘으면 중단"].forEach((rule, i) => {
    text(`rule${i}`, [{ text: `· ${rule}`, color: C.sub }], { x: L, y: 1632 + i * 32, weight: 400, size: 24, minSize: 20, maxWidth: CONTENT_W });
  });

  // ⑦ 푸터 (1700~1760)
  text("handle", [{ text: "@runfit_lab", color: C.orange }], { x: L, y: 1748, weight: 700, size: 28, maxWidth: 260 });
  text("disclaimer", [{ text: "의료 조언이 아닌 일반 훈련 가이드예요", color: C.dim }], { x: R, y: 1748, weight: 400, size: 20, minSize: 16, maxWidth: CONTENT_W - 280, align: "right" });

  return { width: WIDTH, height: HEIGHT, family, ops, overflow };
}

// ---------- draw ----------

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (!r) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function draw(ctx, lay) {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const op of lay.ops) {
    if (op.type === "rect") {
      roundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
      if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(); }
      if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lineWidth; ctx.stroke(); }
    } else if (op.type === "circle") {
      ctx.beginPath();
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      ctx.fillStyle = op.fill;
      ctx.fill();
    } else if (op.type === "text") {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.fillText(op.text, op.x, op.y);
    }
  }
}

// ---------- 브라우저 도우미 ----------

// Pretendard 400/700/800을 기다린다. 실패하면 시스템 폰트 family를 돌려준다 (7.1)
export async function prepareFonts(doc = document, timeoutMs = 5000) {
  if (!doc.fonts?.load) return FALLBACK_FAMILY;
  const weights = [400, 700, 800];
  const loaded = Promise.all(weights.map((w) => doc.fonts.load(`${w} 40px Pretendard`, "런핏랩 10km")))
    .then(() => doc.fonts.ready)
    .then(() => weights.every((w) => doc.fonts.check(`${w} 40px Pretendard`, "런")))
    .catch(() => false);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return (await Promise.race([loaded, timeout])) ? FONT_FAMILY : FALLBACK_FAMILY;
}

// canvas에 그리고 layout(overflow 포함)을 돌려준다
export function renderPlan(plan, canvas, family = FONT_FAMILY) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  const measure = (f, s) => {
    ctx.font = f;
    return ctx.measureText(s).width;
  };
  const lay = layout(plan, measure, { family });
  draw(ctx, lay);
  return lay;
}
