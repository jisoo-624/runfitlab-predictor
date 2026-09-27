// 스텝 UI, 상태, 결과 화면 (SPEC 8장)
import {
  buildPlan, decodeLink, encodeLink, formatClock, formatPace, runningGate, safetyGate, t5FromPace,
} from "../engine/core.js";
import { CONFIG } from "../engine/plan-10k.js";
import { altText, fileName, goalLabel, prepareFonts, renderPlan } from "./render.js";

const YOUTUBE_URL = "https://www.youtube.com/@runfitlab";
const IN_APP = /Instagram|FBAN|FBAV|KAKAOTALK/i.test(navigator.userAgent);
const STEPS = ["step1", "step2", "step3", "step4"];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = { timeMode: "time", input: null };
let fontFamilyPromise = null;

// ---------- 화면 전환 + 브라우저 뒤로 가기 ----------

function show(screen) {
  for (const el of $$(".screen")) el.hidden = el.dataset.screen !== screen;
  window.scrollTo(0, 0);
  const first = $(`[data-screen="${screen}"] h1`);
  if (first) {
    first.setAttribute("tabindex", "-1");
    first.focus({ preventScroll: true });
  }
}

function go(screen, { replace = false, search = "" } = {}) {
  const url = location.pathname + search;
  history[replace ? "replaceState" : "pushState"]({ screen }, "", url);
  show(screen);
}

window.addEventListener("popstate", (e) => {
  const screen = e.state?.screen;
  if (screen === "result") {
    const input = decodeLink(location.search, CONFIG);
    if (input) return showResult(input, { navigate: false });
  }
  show(STEPS.includes(screen) || screen === "gate" ? screen : "step1");
});

// ---------- 입력 읽기 ----------

const radio = (name) => $(`input[name="${name}"]:checked`)?.value ?? null;

function readTime() {
  const m = $("#time-m").value.trim();
  const s = $("#time-s").value.trim();
  if (m === "") return { empty: true };
  const mm = Number(m);
  const ss = s === "" ? 0 : Number(s);
  if (ss > 59) return { error: "초는 0~59 사이로 입력해 주세요." };
  const sec = mm * 60 + ss;
  if (state.timeMode === "pace") {
    const [lo, hi] = CONFIG.paceInputRange;
    if (sec < lo || sec > hi) return { error: "1km 페이스는 4:00~12:00 사이로 입력해 주세요." };
    return { t5: t5FromPace(sec), effort: "training" };
  }
  const [lo, hi] = CONFIG.t5Range;
  if (sec < lo || sec > hi) return { error: "5km 기록은 14:00~60:00 사이로 입력해 주세요." };
  return { t5: sec, effort: "race" };
}

// 10km 목표 기록 (선택). 펼치지 않았거나 비어 있으면 null
function readTarget() {
  if ($("#target-block").hidden || $("#target-fields").hidden) return { target10: null };
  const h = $("#target-h").value.trim();
  const m = $("#target-m").value.trim();
  const s = $("#target-s").value.trim();
  if (h === "" && m === "" && s === "") return { target10: null };
  const hh = Number(h || 0);
  const mm = Number(m || 0);
  const ss = Number(s || 0);
  if (mm > 59 || ss > 59) return { error: "분과 초는 0~59 사이로 입력해 주세요." };
  const sec = hh * 3600 + mm * 60 + ss;
  const [lo, hi] = CONFIG.targetRange;
  if (sec < lo || sec > hi) return { error: "10km 목표 기록은 20:00~2:00:00 사이로 입력해 주세요." };
  return { target10: sec };
}

function collectInput() {
  const time = readTime();
  return {
    continuous5k: radio("continuous5k") === "yes",
    pain: false, // 통증은 묻지 않고 러너 판단에 맡긴다
    t5: time.t5,
    effort: time.effort,
    recentFreq: Number(radio("recentFreq")),
    recentKm: radio("recentKm"),
    freq: Number(radio("freq")),
    longRunDay: radio("longRunDay") ?? "sun",
    target10: readTarget().target10 ?? null,
  };
}

// ---------- 다음 버튼 활성화 ----------

function stepReady(step) {
  if (step === "step1") return radio("continuous5k") !== null;
  if (step === "step2") return !readTime().empty;
  if (step === "step3") {
    const rf = radio("recentFreq");
    return rf !== null && (rf === "0" || radio("recentKm") !== null);
  }
  if (step === "step4") return radio("freq") !== null && radio("longRunDay") !== null;
  return false;
}

function refreshTargetBlock() {
  const t5 = readTime().t5;
  $("#target-block").hidden = t5 !== undefined && t5 > CONFIG.runWalkFrom;
}

function refreshButtons() {
  for (const btn of $$("[data-next]")) btn.disabled = !stepReady(btn.dataset.next);
  refreshTargetBlock();
  // 최근 0회면 1회 거리는 묻지 않는다
  const noRun = radio("recentFreq") === "0";
  const kmField = $("#recent-km-field");
  kmField.disabled = noRun;
  kmField.classList.toggle("is-disabled", noRun);
}

document.addEventListener("change", refreshButtons);
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("time-input")) {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits !== e.target.value) e.target.value = digits;
    $("#time-error").hidden = true;
    $("#target-error").hidden = true;
  }
  refreshButtons();
});

$("#target-toggle").addEventListener("click", () => {
  const fields = $("#target-fields");
  fields.hidden = !fields.hidden;
  $("#target-toggle").setAttribute("aria-expanded", String(!fields.hidden));
  if (!fields.hidden) $("#target-h").focus();
});

// 분 두 자리를 채우면 초로 넘어간다
$("#time-m").addEventListener("input", (e) => {
  if (e.target.value.length === 2) $("#time-s").focus();
});

// ---------- 5km 기록 ↔ 1km 페이스 토글 ----------

function setTimeMode(mode) {
  state.timeMode = mode;
  const pace = mode === "pace";
  $("#t5-title").textContent = pace ? "평소 1km 페이스" : "최근 5km 기록";
  $("#t5-lead").textContent = pace
    ? "편하게 달릴 때 1km에 걸리는 시간을 넣어 주세요."
    : "대회가 아니어도 괜찮아요. 최근에 5km를 달린 시간을 넣어 주세요.";
  $("#mode-toggle").textContent = pace ? "5km 기록으로 입력" : "기록을 몰라요 → 평소 1km 페이스로 입력";
  $("#time-unit").hidden = !pace;
  $("#time-m").placeholder = pace ? "6" : "30";
  $("#time-s").placeholder = pace ? "30" : "00";
  $("#time-m").value = "";
  $("#time-s").value = "";
  $("#time-error").hidden = true;
  refreshButtons();
  $("#time-m").focus();
}

$("#mode-toggle").addEventListener("click", () => setTimeMode(state.timeMode === "time" ? "pace" : "time"));

// ---------- 스텝 진행 + 게이트 (4장) ----------

const GATES = {
  gate_5k: {
    title: "10km 전에 5km 무정지부터 만들어요",
    body: `<p>5km를 쉬지 않고 달릴 수 있게 되면 그때 10km 루틴을 시작해요.</p>
      <div class="table-wrap">
        <table class="gate-table">
          <thead><tr><th scope="col">기간</th><th scope="col">훈련</th><th scope="col">횟수</th></tr></thead>
          <tbody>
            <tr><th scope="row">1~2주</th><td>달리기 3분 + 걷기 1분 × 6번</td><td>주 3회</td></tr>
            <tr><th scope="row">3~4주</th><td>달리기 8분 + 걷기 1분 × 3~4번</td><td>주 3회</td></tr>
            <tr><th scope="row">5주~</th><td>걷지 않고 20분 → 30분 → 5km까지 조금씩 늘리기</td><td>주 3회</td></tr>
          </tbody>
        </table>
      </div>
      <p>5km를 쉬지 않고 달릴 수 있게 되면 다시 만들어 주세요.</p>`,
  },
  gate_notRunning: {
    title: "가볍게 달리는 것부터 시작해요",
    body: "<p>최근 한 달 달리지 않았다면 2~3주 동안 주 2~3회 가볍게 달린 뒤 다시 만들어 주세요.</p>",
  },
  gate_volume: {
    title: "조금 더 적응한 뒤에 시작해요",
    body: (r) => `<p>지금 주간 거리(${r.B}km)에서 4주 만에 10km는 부상 위험이 커요. 2~3주 동안 주 2~3회, 4~5km씩 달리며 적응한 뒤 다시 만들어 주세요.</p>`,
  },
};

function showGate(result) {
  const g = GATES[result.type];
  $("#gate-title").textContent = g.title;
  $("#gate-body").innerHTML = typeof g.body === "function" ? g.body(result) : g.body;
  go("gate");
}

const NEXT = { step1: "step2", step2: "step3", step3: "step4" };

for (const btn of $$("[data-next]")) {
  btn.addEventListener("click", () => {
    const step = btn.dataset.next;
    const input = collectInput();
    if (step === "step1") {
      const gate = safetyGate(input);
      return gate ? showGate(gate) : go(NEXT[step]);
    }
    if (step === "step2") {
      const time = readTime();
      if (time.error) {
        $("#time-error").textContent = time.error;
        $("#time-error").hidden = false;
        return;
      }
      const target = readTarget();
      if (target.error) {
        $("#target-error").textContent = target.error;
        $("#target-error").hidden = false;
        return;
      }
      return go(NEXT[step]);
    }
    if (step === "step3") {
      const gate = runningGate(input);
      return gate ? showGate(gate) : go(NEXT[step]);
    }
    if (step === "step4") {
      let result;
      try {
        result = buildPlan(input, CONFIG);
      } catch {
        // 브라우저 앞으로 가기 등으로 앞 스텝 값이 비었거나 잘못된 경우
        return go("step1");
      }
      return result.type === "plan" ? showResult(input) : showGate(result);
    }
  });
}

for (const btn of $$("[data-back]")) btn.addEventListener("click", () => history.back());

function resetForm() {
  for (const el of $$('input[type="radio"]')) el.checked = el.name === "longRunDay" && el.value === "sun";
  if (state.timeMode !== "time") setTimeMode("time");
  $("#time-m").value = "";
  $("#time-s").value = "";
  $("#time-error").hidden = true;
  for (const id of ["#target-h", "#target-m", "#target-s"]) $(id).value = "";
  $("#target-fields").hidden = true;
  $("#target-toggle").setAttribute("aria-expanded", "false");
  $("#target-error").hidden = true;
  refreshButtons();
}

for (const btn of $$("[data-restart]")) {
  btn.addEventListener("click", () => {
    resetForm();
    go("step1");
  });
}

// ---------- 결과 화면 (8.3) ----------

const NOTE_TEXT = {
  gentle: () => "지금 달리는 양에 맞춰 1주차를 가볍게 시작해요.",
  note_training: () => "평소 페이스 기준이라 실제 실력은 더 빠를 수 있어요. 안전한 쪽으로 계산했어요.",
  note_fast: () => "이 기록이면 완주는 충분해요. 기록 단축 루틴은 곧 공개할게요.",
  note_target: (p) => `목표 기록 ${formatClock(p.target10)}에 맞춰 페이스를 계산했어요.`,
};

// 눈에 띄게 따로 보여 줄 경고
const WARNING_TEXT = {
  note_targetTooFast: (p) => ({
    title: "목표 기록은 이번 루틴에 반영하지 않았어요",
    body: `지금 기록으로 4주 안에 목표(${formatClock(p.target10)})까지 줄이면 부상 위험이 커요. 예상 기록(${formatClock(p.goalTime)}) 기준으로 짰어요. 4주 안에 무리 없는 목표는 ${formatClock(p.targetLimit)}부터예요.`,
  }),
};

const DAY_LABEL = { sun: "일요일", sat: "토요일" };

async function showResult(input, { navigate = true, replace = false } = {}) {
  const plan = buildPlan(input, CONFIG);
  state.input = input;
  if (navigate) go("result", { replace, search: `?${encodeLink(input)}` });
  else show("result");

  // 상단 요약
  $("#result-eyebrow").textContent = `주 ${plan.freq}회 · ${DAY_LABEL[plan.longRunDay]} 롱런`;
  $("#stat-goal-label").textContent = plan.goalShown ? goalLabel(plan) : "목표";
  $("#stat-goal").textContent = plan.goalShown ? formatClock(plan.goalTime) : "걷기 섞어 완주";
  $("#stat-easy").textContent = plan.pace.easy.map(formatPace).join("~");
  $("#stat-long").textContent = `${plan.weeks[0].cells[6].km}→${plan.weeks[3].cells[6].km}km`;

  const warningKey = plan.notes.find((n) => WARNING_TEXT[n]);
  $("#result-warning").hidden = !warningKey;
  if (warningKey) {
    const w = WARNING_TEXT[warningKey](plan);
    $("#result-warning-title").textContent = w.title;
    $("#result-warning-body").textContent = w.body;
  }

  const notes = [
    plan.tier === "gentle" && NOTE_TEXT.gentle(plan),
    ...plan.notes.filter((n) => NOTE_TEXT[n]).map((n) => NOTE_TEXT[n](plan)),
  ].filter(Boolean);
  const notesEl = $("#result-notes");
  notesEl.replaceChildren(...notes.map((n) => Object.assign(document.createElement("li"), { textContent: n })));
  notesEl.hidden = notes.length === 0;

  $("#howto-mine").textContent = !plan.goalShown
    ? `내 기록 기준: 5km ${formatClock(plan.t5)}. 40분을 넘어서 목표 시간 대신 걷기를 섞어서라도 끝까지 완주하는 걸 목표로 잡았어요.`
    : plan.targetApplied
      ? `내 기록 기준: 5km ${formatClock(plan.t5)} → 10km 예측 ${formatClock(plan.t10)}. 목표(${formatClock(plan.goalTime)})가 예측보다 5% 이내라서 목표 기준으로 페이스를 계산했어요.`
      : `내 기록 기준: 5km ${formatClock(plan.t5)} → 10km 예측 ${formatClock(plan.t10)}. ${goalLabel(plan)}은 예측보다 1km당 10초 여유를 둔 ${formatClock(plan.goalTime)}이에요.`;

  const img = $("#result-img");
  img.hidden = true;
  $("#result-loading").hidden = false;

  fontFamilyPromise ??= prepareFonts();
  const family = await fontFamilyPromise;
  if (state.input !== input) return; // 그사이 다른 입력으로 바뀌었으면 버린다

  const canvas = document.createElement("canvas");
  renderPlan(plan, canvas, family);
  img.src = canvas.toDataURL("image/png");
  img.alt = altText(plan);
  img.dataset.filename = fileName(plan);
  img.hidden = false;
  $("#result-loading").hidden = true;
}

// 인앱 브라우저에서는 다운로드를 시도하지 않고 길게 눌러 저장을 안내한다
if (IN_APP) {
  $("#save-btn").hidden = true;
  $("#save-hint").hidden = false;
}

$("#save-btn").addEventListener("click", () => {
  const img = $("#result-img");
  if (img.hidden || !img.src) return;
  const a = document.createElement("a");
  a.href = img.src;
  a.download = img.dataset.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

let toastTimer;
function toast(msg) {
  const el = $("#copy-toast");
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.textContent = ""; }, 2500);
}

$("#copy-btn").addEventListener("click", async () => {
  if (!state.input) return;
  const url = `${location.origin}${location.pathname}?${encodeLink(state.input)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast("링크를 복사했어요");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    toast(ok ? "링크를 복사했어요" : url);
  }
});

// ---------- 시작 (8.4) ----------

if (YOUTUBE_URL) {
  const yt = $("#youtube-link");
  yt.href = YOUTUBE_URL;
  yt.hidden = false;
}

refreshButtons();

const linked = location.search ? decodeLink(location.search, CONFIG) : null;
if (linked && buildPlan(linked, CONFIG).type === "plan") {
  // 링크로 열면 게이트는 통과한 것으로 보고 결과를 바로 연다
  showResult(linked, { replace: true });
} else {
  go("step1", { replace: true });
}
