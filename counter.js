// 방문자 카운트 (GoatCounter, 쿠키 없음)
// 1) 이 페이지 방문을 기록하고 2) 사이트 전체 누적 방문 수를 [data-visit-count]에 표시한다.
// 코드가 비어 있거나 요청이 실패하면 아무것도 표시하지 않는다.
(function () {
  const GOATCOUNTER_CODE = "runfitlab";
  if (!GOATCOUNTER_CODE) return;

  const base = "https://" + GOATCOUNTER_CODE + ".goatcounter.com";

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = base + "/count";
  document.head.appendChild(s);

  function show() {
    const el = document.querySelector("[data-visit-count]");
    if (!el) return;
    fetch(base + "/counter/TOTAL.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        const n = Number(String(data.count).replace(/\D/g, ""));
        if (!n) return;
        el.textContent = "누적 방문 " + n.toLocaleString("ko-KR") + "회";
        el.hidden = false;
      })
      .catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", show);
  } else {
    show();
  }
})();
