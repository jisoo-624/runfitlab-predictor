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
  var input5k = document.getElementById("time5k");
  var input10k = document.getElementById("time10k");
  var formError = document.getElementById("form-error");
  var resetBtn = document.getElementById("reset-btn");
  var resultSection = document.getElementById("result-section");
  var basisText = document.getElementById("basis-text");
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

  function parseTimeToSeconds(str) {
    if (!str) return null;
    var trimmed = str.trim();
    if (trimmed === "") return null;
    if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(trimmed)) return null;

    var parts = trimmed.split(":").map(function (p) {
      return parseInt(p, 10);
    });

    var hh = 0, mm = 0, ss = 0;
    if (parts.length === 2) {
      mm = parts[0];
      ss = parts[1];
    } else {
      hh = parts[0];
      mm = parts[1];
      ss = parts[2];
    }

    if (mm >= 60 || ss >= 60) return null;

    var total = hh * 3600 + mm * 60 + ss;
    if (total <= 0) return null;
    return total;
  }

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

    var t5 = parseTimeToSeconds(input5k.value);
    var t10 = parseTimeToSeconds(input10k.value);

    var raw5 = input5k.value.trim();
    var raw10 = input10k.value.trim();

    if (raw5 !== "" && t5 === null) {
      showError("5km 기록 형식을 확인해주세요. 예: 23:30");
      return;
    }
    if (raw10 !== "" && t10 === null) {
      showError("10km 기록 형식을 확인해주세요. 예: 49:00");
      return;
    }
    if (t5 === null && t10 === null) {
      showError("5km 또는 10km 기록을 하나 이상 입력해주세요.");
      return;
    }

    var halfPredictions = [];
    var fullPredictions = [];
    var basisParts = [];

    if (t5 !== null) {
      halfPredictions.push(riegelPredict(t5, DISTANCE.five, DISTANCE.half));
      fullPredictions.push(riegelPredict(t5, DISTANCE.five, DISTANCE.full));
      basisParts.push("5km " + formatSecondsToTime(t5));
    }
    if (t10 !== null) {
      halfPredictions.push(riegelPredict(t10, DISTANCE.ten, DISTANCE.half));
      fullPredictions.push(riegelPredict(t10, DISTANCE.ten, DISTANCE.full));
      basisParts.push("10km " + formatSecondsToTime(t10));
    }

    var finalHalf = average(halfPredictions);
    var finalFull = average(fullPredictions);

    var basisLabel = "기준 기록: " + basisParts.join(" · ") +
      (basisParts.length === 2 ? " (두 예측의 평균)" : "");

    lastResult = {
      basisLabel: basisLabel,
      basisParts: basisParts,
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

  function renderResult(result) {
    basisText.textContent = result.basisLabel;

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
    var W = 1080, H = 1150;
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
    ctx.fillText("Riegel Formula (지수 1.06) 기반 예측", cx, y);

    y += 30;
    ctx.font = "500 20px -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillStyle = "#9aa1b0";
    ctx.fillText("기준 기록: " + result.basisParts.join("  ·  "), cx, y);

    // predict boxes
    y += 60;
    var boxW = (W - pad * 2 - 100) / 2;
    var boxH = 260;
    var boxY = y;
    var leftX = pad + 50;
    var rightX = leftX + boxW + 40;

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
    ctx.fillText("RunFitLab", cx, H - pad - 6);

    return canvas;
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
