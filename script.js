(function () {
  "use strict";

  // Riegel Formula: T2 = T1 * (D2 / D1) ^ 1.06
  var RIEGEL_EXPONENT = 1.06;

  var DISTANCE = {
    five: 5,
    ten: 10,
    half: 21.0975,
    full: 42.195
  };

  var PACE_BAND_OFFSETS = [-6, -4, -2, 0, 2, 4, 6];

  var form = document.getElementById("predict-form");
  var input5kMin = document.getElementById("time5k-m");
  var input5kSec = document.getElementById("time5k-s");
  var input10kMin = document.getElementById("time10k-m");
  var input10kSec = document.getElementById("time10k-s");
  var formError = document.getElementById("form-error");
  var resetBtn = document.getElementById("reset-btn");
  var resultSection = document.getElementById("result-section");
  var basisGrid = document.getElementById("basis-grid");
  var basisNote = document.getElementById("basis-note");
  var halfTimeEl = document.getElementById("half-time");
  var halfPaceEl = document.getElementById("half-pace");
  var fullTimeEl = document.getElementById("full-time");
  var fullPaceEl = document.getElementById("full-pace");
  var halfTableBody = document.querySelector("#half-table tbody");
  var fullTableBody = document.querySelector("#full-table tbody");
  var tabButtons = document.querySelectorAll(".tab-btn");
  var halfTable = document.getElementById("half-table");
  var fullTable = document.getElementById("full-table");
  var saveImageBtn = document.getElementById("save-image-btn");

  var lastResult = null; // in-memory only, cleared on reload; never persisted to storage

  // ---------- time parsing / formatting ----------

  function readMinSecInputs(minInput, secInput) {
    var rawM = minInput.value.trim();
    var rawS = secInput.value.trim();

    if (rawM === "" && rawS === "") {
      return { seconds: null, touched: false };
    }
    if (!/^\d*$/.test(rawM) || !/^\d*$/.test(rawS)) {
      return { seconds: null, touched: true };
    }

    var mm = rawM === "" ? 0 : parseInt(rawM, 10);
    var ss = rawS === "" ? 0 : parseInt(rawS, 10);
    if (ss >= 60) {
      return { seconds: null, touched: true };
    }

    var total = mm * 60 + ss;
    if (total <= 0) {
      return { seconds: null, touched: true };
    }
    return { seconds: total, touched: true };
  }

  function sanitizeDigitsOnly(e) {
    var digits = e.target.value.replace(/\D/g, "");
    if (digits !== e.target.value) {
      e.target.value = digits;
    }
  }

  [input5kMin, input5kSec, input10kMin, input10kSec].forEach(function (el) {
    el.addEventListener("input", sanitizeDigitsOnly);
  });

  function pad2(n) {
    return String(Math.round(n)).padStart(2, "0");
  }

  function formatSecondsToTime(totalSeconds) {
    var t = Math.round(totalSeconds);
    var hh = Math.floor(t / 3600);
    var mm = Math.floor((t % 3600) / 60);
    var ss = t % 60;
    if (hh > 0) {
      return hh + ":" + pad2(mm) + ":" + pad2(ss);
    }
    return mm + ":" + pad2(ss);
  }

  function formatPace(secondsPerKm) {
    var mm = Math.floor(secondsPerKm / 60);
    var ss = Math.round(secondsPerKm % 60);
    if (ss === 60) {
      mm += 1;
      ss = 0;
    }
    return mm + ":" + pad2(ss);
  }

  // ---------- prediction ----------

  function riegelPredict(t1, d1, d2) {
    return t1 * Math.pow(d2 / d1, RIEGEL_EXPONENT);
  }

  function average(arr) {
    var sum = arr.reduce(function (a, b) { return a + b; }, 0);
    return sum / arr.length;
  }

  function calculate() {
    formError.hidden = true;

    var r5 = readMinSecInputs(input5kMin, input5kSec);
    var r10 = readMinSecInputs(input10kMin, input10kSec);
    var t5 = r5.seconds;
    var t10 = r10.seconds;

    if (r5.touched && t5 === null) {
      showError("5km 기록을 확인해주세요. 초는 0~59 사이여야 합니다.");
      return;
    }
    if (r10.touched && t10 === null) {
      showError("10km 기록을 확인해주세요. 초는 0~59 사이여야 합니다.");
      return;
    }
    if (t5 === null && t10 === null) {
      showError("5km 또는 10km 기록을 하나 이상 입력해주세요.");
      return;
    }

    var halfPredictions = [];
    var fullPredictions = [];
    var basisList = [];

    if (t5 !== null) {
      halfPredictions.push(riegelPredict(t5, DISTANCE.five, DISTANCE.half));
      fullPredictions.push(riegelPredict(t5, DISTANCE.five, DISTANCE.full));
      basisList.push({ label: "5km 기준", seconds: t5, distanceKm: DISTANCE.five });
    }
    if (t10 !== null) {
      halfPredictions.push(riegelPredict(t10, DISTANCE.ten, DISTANCE.half));
      fullPredictions.push(riegelPredict(t10, DISTANCE.ten, DISTANCE.full));
      basisList.push({ label: "10km 기준", seconds: t10, distanceKm: DISTANCE.ten });
    }

    var finalHalf = average(halfPredictions);
    var finalFull = average(fullPredictions);

    lastResult = {
      basisList: basisList,
      half: finalHalf,
      full: finalFull
    };

    renderResult(lastResult);
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
    resultSection.hidden = true;
  }

  function renderBasisGrid(container, basisList) {
    container.innerHTML = "";
    container.classList.toggle("single", basisList.length === 1);
    basisList.forEach(function (item) {
      var box = document.createElement("div");
      box.className = "predict-box basis-box";

      var label = document.createElement("span");
      label.className = "predict-label";
      label.textContent = item.label;

      var time = document.createElement("span");
      time.className = "predict-time";
      time.textContent = formatSecondsToTime(item.seconds);

      var pace = document.createElement("span");
      pace.className = "predict-pace";
      pace.textContent = "평균 페이스 " + formatPace(item.seconds / item.distanceKm) + "/km";

      box.appendChild(label);
      box.appendChild(time);
      box.appendChild(pace);
      container.appendChild(box);
    });
  }

  function renderResult(result) {
    renderBasisGrid(basisGrid, result.basisList);
    basisNote.hidden = result.basisList.length < 2;
    if (result.basisList.length >= 2) {
      basisNote.textContent = "* 하프·풀코스 예상 기록은 5km, 10km 기록으로 각각 예측한 값의 평균입니다.";
    }

    halfTimeEl.textContent = formatSecondsToTime(result.half);
    halfPaceEl.textContent = "평균 페이스 " + formatPace(result.half / DISTANCE.half) + "/km";

    fullTimeEl.textContent = formatSecondsToTime(result.full);
    fullPaceEl.textContent = "평균 페이스 " + formatPace(result.full / DISTANCE.full) + "/km";

    renderPaceTable(halfTableBody, result.half, DISTANCE.half);
    renderPaceTable(fullTableBody, result.full, DISTANCE.full);

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function offsetLabel(offset) {
    if (offset === 0) return "목표 페이스";
    if (offset < 0) return Math.abs(offset) + "% 도전";
    return offset + "% 여유";
  }

  function renderPaceTable(tbody, totalSeconds, distanceKm) {
    tbody.innerHTML = "";
    PACE_BAND_OFFSETS.forEach(function (offset) {
      var t = totalSeconds * (1 + offset / 100);
      var pace = t / distanceKm;

      var tr = document.createElement("tr");
      if (offset === 0) tr.className = "target-row";

      var tdLabel = document.createElement("td");
      tdLabel.textContent = offsetLabel(offset);

      var tdPace = document.createElement("td");
      tdPace.textContent = formatPace(pace) + "/km";

      var tdTotal = document.createElement("td");
      tdTotal.textContent = formatSecondsToTime(t);

      tr.appendChild(tdLabel);
      tr.appendChild(tdPace);
      tr.appendChild(tdTotal);
      tbody.appendChild(tr);
    });
  }

  // ---------- tabs ----------

  function switchTab(tab) {
    tabButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    halfTable.hidden = tab !== "half";
    fullTable.hidden = tab !== "full";
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchTab(btn.dataset.tab);
    });
  });

  // ---------- form events ----------

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });

  resetBtn.addEventListener("click", function () {
    form.reset();
    formError.hidden = true;
    resultSection.hidden = true;
    lastResult = null;
  });

  // ---------- image export (canvas, no external libs, no storage) ----------

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildResultImage(result) {
    var W = 1080, H = 1330;
    var canvas = document.getElementById("export-canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    // background
    var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#eef2fb");
    bgGrad.addColorStop(1, "#f4f6fb");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // main card
    var pad = 60;
    drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(20,25,40,0.10)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    var cx = W / 2;
    var y = pad + 90;

    // title
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a1d29";
    ctx.font = "800 46px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillText("RunFitLab 예상 기록", cx, y);

    y += 40;
    ctx.font = "600 22px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Riegel Formula 기반 예측", cx, y);

    // basis record boxes
    y += 54;
    var boxW = (W - pad * 2 - 100) / 2;
    var leftX = pad + 50;
    var rightX = leftX + boxW + 40;
    var basisBoxH = 150;
    var basisY = y;

    if (result.basisList.length === 1) {
      drawBasisBox(ctx, leftX, basisY, boxW * 2 + 40, basisBoxH, "#f1f3f9", "#1a1d29", result.basisList[0]);
    } else {
      drawBasisBox(ctx, leftX, basisY, boxW, basisBoxH, "#f1f3f9", "#1a1d29", result.basisList[0]);
      drawBasisBox(ctx, rightX, basisY, boxW, basisBoxH, "#f1f3f9", "#1a1d29", result.basisList[1]);
    }

    // predict boxes
    y = basisY + basisBoxH + 34;
    var boxH = 260;
    var boxY = y;

    drawPredictBox(ctx, leftX, boxY, boxW, boxH, "#eff4ff", "#2563eb",
      "하프마라톤", "21.0975km", formatSecondsToTime(result.half),
      formatPace(result.half / DISTANCE.half) + "/km 평균 페이스");

    drawPredictBox(ctx, rightX, boxY, boxW, boxH, "#fff3ea", "#ea580c",
      "풀마라톤", "42.195km", formatSecondsToTime(result.full),
      formatPace(result.full / DISTANCE.full) + "/km 평균 페이스");

    // pace band table (full course, compact)
    var tableY = boxY + boxH + 70;
    ctx.textAlign = "left";
    ctx.font = "800 26px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#1a1d29";
    ctx.fillText("풀코스 1km 페이스 밴드", leftX, tableY);

    var rows = PACE_BAND_OFFSETS.map(function (offset) {
      var t = result.full * (1 + offset / 100);
      var pace = t / DISTANCE.full;
      return {
        label: offsetLabel(offset),
        pace: formatPace(pace) + "/km",
        total: formatSecondsToTime(t),
        target: offset === 0
      };
    });

    var rowStartY = tableY + 34;
    var rowH = 52;
    var tableW = W - pad * 2 - 100;
    var col1 = leftX;
    var col2 = leftX + tableW * 0.4;
    var col3 = leftX + tableW * 0.72;

    ctx.font = "600 18px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#9aa1b0";
    ctx.fillText("구간", col1, rowStartY);
    ctx.fillText("1km 페이스", col2, rowStartY);
    ctx.fillText("완주 예상 시간", col3, rowStartY);

    rows.forEach(function (row, i) {
      var ry = rowStartY + 20 + i * rowH;
      if (row.target) {
        drawRoundedRect(ctx, leftX - 16, ry - 30, tableW + 32, rowH - 8, 10);
        ctx.fillStyle = "#fff9e6";
        ctx.fill();
      }
      ctx.font = (row.target ? "800 22px" : "500 20px") +
        " -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      ctx.fillStyle = "#1a1d29";
      ctx.fillText(row.label, col1, ry);
      ctx.fillText(row.pace, col2, ry);
      ctx.fillText(row.total, col3, ry);
    });

    // footer
    ctx.textAlign = "center";
    ctx.font = "500 16px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#9aa1b0";
    ctx.fillText("* 실제 레이스 결과는 컨디션, 코스, 날씨에 따라 달라질 수 있습니다.", cx, H - pad - 34);
    ctx.font = "700 18px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#2563eb";
    ctx.fillText("instagram.com/runfit_lab", cx, H - pad - 6);

    return canvas;
  }

  function drawBasisBox(ctx, x, y, w, h, bg, accent, item) {
    drawRoundedRect(ctx, x, y, w, h, 20);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.textAlign = "left";
    var px = x + 28;
    var py = y + 44;

    ctx.font = "700 20px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(item.label, px, py);

    py += 48;
    ctx.font = "800 38px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText(formatSecondsToTime(item.seconds), px, py);

    py += 30;
    ctx.font = "500 16px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("평균 페이스 " + formatPace(item.seconds / item.distanceKm) + "/km", px, py);
  }

  function drawPredictBox(ctx, x, y, w, h, bg, accent, label, distLabel, timeText, paceText) {
    drawRoundedRect(ctx, x, y, w, h, 20);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.textAlign = "left";
    var px = x + 32;
    var py = y + 56;

    ctx.font = "700 22px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(label, px, py);

    py += 26;
    ctx.font = "500 16px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#9aa1b0";
    ctx.fillText(distLabel, px, py);

    py += 66;
    ctx.font = "800 52px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText(timeText, px, py);

    py += 34;
    ctx.font = "500 18px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(paceText, px, py);
  }

  saveImageBtn.addEventListener("click", function () {
    if (!lastResult) return;
    var canvas = buildResultImage(lastResult);
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var ts = new Date();
      var stamp = ts.getFullYear() +
        String(ts.getMonth() + 1).padStart(2, "0") +
        String(ts.getDate()).padStart(2, "0") + "-" +
        String(ts.getHours()).padStart(2, "0") +
        String(ts.getMinutes()).padStart(2, "0");
      a.href = url;
      a.download = "runfitlab-result-" + stamp + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  });
})();
