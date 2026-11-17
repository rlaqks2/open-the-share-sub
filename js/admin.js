(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = n => (n ? Number(n).toLocaleString("ko-KR") : "-");
  const fmtTime = m => ((m >= 60 ? Math.floor(m / 60) + "시간" : "") + (m % 60 ? " " + (m % 60) + "분" : "")).trim();
  const ENDPOINT = SITE_CONFIG.ENDPOINT;
  const DEMO = !ENDPOINT;
  const LV = { "하": 1, "중": 2, "상": 3 };

  let toastT;
  const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400); };
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { } }, del: k => { try { sessionStorage.removeItem(k); } catch { } } };

  async function api(body) {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    return r.json();
  }

  /* ---------- 로그인 ---------- */
  const loginForm = $("#loginForm");
  if (DEMO) {
    $("#loginHint").innerHTML = "지금은 <b>미리보기 모드</b>(config.js의 ENDPOINT 미설정)라 비밀번호 없이 들어갑니다.<br>수정한 단가는 <b>이 브라우저에만</b> 저장돼요.";
    $("#keyWrap").hidden = true;
    loginForm.key.required = false;
  } else {
    $("#loginHint").textContent = "Apps Script에 설정한 관리자 비밀번호(ADMIN_KEY)를 입력하세요.";
  }
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $(".form-msg", loginForm), btn = $("button", loginForm);
    if (DEMO) return enter();
    const key = loginForm.key.value;
    if (!key) return;
    btn.disabled = true; msg.className = "form-msg"; msg.textContent = "확인 중…";
    try {
      const r = await api({ type: "auth", key });
      if (r.ok) { ss.set("ots_admin_key", key); enter(); }
      else { msg.className = "form-msg err"; msg.textContent = "비밀번호가 맞지 않아요."; }
    } catch { msg.className = "form-msg err"; msg.textContent = "서버에 연결하지 못했어요. ENDPOINT 주소를 확인해 주세요."; }
    finally { btn.disabled = false; }
  });
  $("#logout").onclick = () => { if (dirtyCount() && !confirm("저장하지 않은 변경 사항이 있어요. 나갈까요?")) return; ss.del("ots_admin_key"); location.reload(); };

  /* ---------- 상태 ---------- */
  let saved = {};   // 현재 저장된(홈페이지에 반영된) 단가
  let draft = {};   // 편집 중 단가
  const view = { q: "", group: "", level: "", changed: false, sort: "page", desc: false };

  async function enter() {
    $("#login").hidden = true; $("#app").hidden = false; $("#logout").hidden = false;
    const src = await loadPriceOverrides();
    KITS.forEach(k => { saved[k.name] = k.price || k.basePrice || 0; });
    draft = { ...saved };
    const banner = $("#modeBanner");
    if (DEMO) { banner.className = "mode-banner demo"; banner.innerHTML = "<b>미리보기 모드</b> · 저장하면 이 브라우저의 홈페이지에만 반영됩니다. 모든 방문자에게 반영하려면 README의 구글 시트 연결을 먼저 해 주세요. (또는 아래 ‘prices.js 내보내기’로 파일 교체)"; }
    else { banner.className = "mode-banner live"; banner.innerHTML = src === "remote" ? "<b>연결됨</b> · 저장하면 구글 시트 ‘단가’ 탭에 기록되고 홈페이지 모든 방문자에게 바로 반영됩니다." : "<b>주의</b> · 시트에서 단가를 불러오지 못해 기본 단가를 표시합니다."; }
    render();
  }
  if (DEMO || ss.get("ots_admin_key")) enter();

  /* ---------- 필터 / 정렬 ---------- */
  Object.keys(GROUPS).forEach(g => $("#fGroup").insertAdjacentHTML("beforeend", `<option>${esc(g)}</option>`));
  $("#q").oninput = e => { view.q = e.target.value.trim().toLowerCase(); render(); };
  $("#fGroup").onchange = e => { view.group = e.target.value; render(); };
  $("#fLevel").onchange = e => { view.level = e.target.value; render(); };
  $("#fChanged").onchange = e => { view.changed = e.target.checked; render(); };
  $$("th[data-sort]").forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    view.desc = view.sort === k ? !view.desc : false; view.sort = k; render();
  });

  function visible() {
    let list = KITS.filter(k =>
      (!view.q || k.name.toLowerCase().includes(view.q) || k.method.includes(view.q)) &&
      (!view.group || k.group === view.group) &&
      (!view.level || k.level === view.level) &&
      (!view.changed || draft[k.name] !== saved[k.name]));
    const key = { name: k => k.name, group: k => k.group, level: k => LV[k.level], minutes: k => k.minutes, base: k => k.basePrice || 0, price: k => draft[k.name] || 0, page: k => k.page }[view.sort];
    list = list.slice().sort((a, b) => { const x = key(a), y = key(b); const c = typeof x === "string" ? x.localeCompare(y, "ko") : x - y; return view.desc ? -c : c; });
    return list;
  }

  function diffHTML(k) {
    const d = (draft[k.name] || 0) - (saved[k.name] || 0);
    if (!d) return "";
    return `<span class="diff ${d > 0 ? "up" : "down"}">저장값 대비 ${d > 0 ? "+" : ""}${d.toLocaleString()}</span>`;
  }

  function render() {
    const list = visible();
    $$("th[data-sort]").forEach(th => { th.classList.toggle("sorted", th.dataset.sort === view.sort); th.classList.toggle("desc", th.dataset.sort === view.sort && view.desc); });
    $("#rows").innerHTML = list.map(k => `
      <tr data-name="${esc(k.name)}" class="${draft[k.name] !== saved[k.name] ? "dirty" : ""}">
        <td class="c-img"><img src="${k.img}" alt="" loading="lazy"></td>
        <td><b>${esc(k.name)}</b></td>
        <td class="c-grp">${esc(k.group)}<br><small class="hint">${k.method}</small></td>
        <td><span class="lv lv-${k.level}">${k.level}</span></td>
        <td class="c-min">${fmtTime(k.minutes)}</td>
        <td class="num">${won(k.basePrice)}</td>
        <td class="num"><label class="price-in"><input type="number" min="0" step="500" inputmode="numeric" value="${draft[k.name] || ""}" data-price="${esc(k.name)}" aria-label="${esc(k.name)} 판매 단가"><span>원</span></label>${diffHTML(k)}</td>
        <td class="c-act"><button class="row-reset" data-reset="${esc(k.name)}" title="기본 단가로">기본값</button></td>
      </tr>`).join("") || `<tr><td colspan="8" class="hint" style="text-align:center;padding:2rem">조건에 맞는 키트가 없어요.</td></tr>`;
    $("#bulkTarget").textContent = `(현재 목록 ${list.length}종에 적용)`;
    updateMeta();
  }

  function updateMeta() {
    const vals = KITS.map(k => draft[k.name]).filter(v => v > 0);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 100) * 100 : 0;
    $("#stats").innerHTML = `
      <div class="stat">키트<b>${KITS.length}종</b></div>
      <div class="stat">최저<b>${won(Math.min(...vals))}원</b></div>
      <div class="stat">평균<b>${won(avg)}원</b></div>
      <div class="stat">최고<b>${won(Math.max(...vals))}원</b></div>`;
    const n = dirtyCount();
    $("#savebar").hidden = n === 0;
    $("#dirtyText").textContent = `변경 사항 ${n}건 · 저장 전입니다`;
  }
  const dirtyCount = () => KITS.filter(k => draft[k.name] !== saved[k.name]).length;

  /* ---------- 개별 수정 ---------- */
  $("#rows").addEventListener("input", e => {
    const inp = e.target.closest("[data-price]"); if (!inp) return;
    const name = inp.dataset.price, v = Math.round(Number(inp.value));
    const ok = Number.isFinite(v) && v > 0;
    inp.classList.toggle("bad", !ok);
    draft[name] = ok ? v : saved[name];
    const tr = inp.closest("tr"), k = KITS.find(x => x.name === name);
    tr.classList.toggle("dirty", draft[name] !== saved[name]);
    tr.querySelector(".diff")?.remove();
    inp.closest("td").insertAdjacentHTML("beforeend", diffHTML(k));
    updateMeta();
  });
  $("#rows").addEventListener("click", e => {
    const b = e.target.closest("[data-reset]"); if (!b) return;
    const k = KITS.find(x => x.name === b.dataset.reset);
    draft[k.name] = k.basePrice; render();
  });

  /* ---------- 일괄 조정 ---------- */
  const round100 = v => Math.max(100, Math.round(v / 100) * 100);
  $$("[data-bulk]").forEach(b => b.onclick = () => {
    const list = visible(), act = b.dataset.bulk;
    const pct = Number($("#bulkPct").value) || 0, amt = Math.round(Number($("#bulkWon").value) || 0);
    if (!list.length) return;
    if (act === "set" && amt <= 0) return toast("금액을 입력해 주세요.");
    if (act === "set" && !confirm(`현재 목록 ${list.length}종을 모두 ${amt.toLocaleString()}원으로 바꿀까요?`)) return;
    if (act === "reset" && !confirm(`현재 목록 ${list.length}종을 기본 단가(prices.js)로 되돌릴까요?`)) return;
    list.forEach(k => {
      const cur = draft[k.name] || k.basePrice || 0;
      draft[k.name] = {
        up: () => round100(cur * (1 + pct / 100)),
        down: () => round100(cur * (1 - pct / 100)),
        plus: () => round100(cur + amt),
        minus: () => round100(cur - amt),
        set: () => amt,
        reset: () => k.basePrice,
      }[act]();
    });
    render();
    toast(`${list.length}종에 적용했어요. 저장을 눌러야 반영됩니다.`);
  });

  /* ---------- 저장 / 취소 ---------- */
  $("#discard").onclick = () => { draft = { ...saved }; render(); };
  $("#save").onclick = async () => {
    const btn = $("#save"); btn.disabled = true; btn.textContent = "저장 중…";
    try {
      if (DEMO) {
        localStorage.setItem(PRICE_LOCAL_KEY, JSON.stringify(draft));
      } else {
        const r = await api({ type: "prices", key: ss.get("ots_admin_key"), prices: draft });
        if (!r.ok) {
          if (r.error === "unauthorized") { toast("로그인이 만료됐어요. 다시 로그인해 주세요."); ss.del("ots_admin_key"); setTimeout(() => location.reload(), 1200); return; }
          throw new Error(r.error || "save failed");
        }
      }
      saved = { ...draft };
      render();
      toast(DEMO ? "저장했어요 (이 브라우저의 홈페이지에 반영)" : "저장했어요. 홈페이지에 바로 반영됩니다.");
    } catch (err) {
      console.error(err); toast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally { btn.disabled = false; btn.textContent = "저장하기"; }
  };
  window.addEventListener("beforeunload", e => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "s" && dirtyCount()) { e.preventDefault(); $("#save").click(); } });

  /* ---------- 내보내기 / 가져오기 ---------- */
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $("#exportJs").onclick = () => {
    const d = new Date().toISOString().slice(0, 10);
    const body = KITS.map(k => `  ${JSON.stringify(k.name)}: ${draft[k.name] || 0},`).join("\n");
    download("prices.js", `/* =========================================================
   키트 기본 단가 (1인 기준, 원) — 관리자 페이지에서 내보냄 (${d})
   - 관리자 페이지(admin.html)에서 수정하면 이 값 위에 덮어써집니다.
   ========================================================= */
const PRICE = {
${body}
};
`, "text/javascript;charset=utf-8");
  };
  $("#exportCsv").onclick = () => {
    const rows = [["키트명", "분류", "제작방식", "난이도", "소요시간(분)", "기본 단가", "판매 단가"]]
      .concat(KITS.map(k => [k.name, k.group, k.method, k.level, k.minutes, k.basePrice || "", draft[k.name] || ""]));
    const csv = "﻿" + rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\r\n");
    download(`키트단가_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  };
  $("#importCsv").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = (await file.text()).replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter(Boolean).map(l => l.split(",").map(s => s.replace(/^"|"$/g, "").trim()));
    const head = lines[0] || [];
    const iName = Math.max(0, head.findIndex(h => h.includes("키트")));
    let iPrice = head.findIndex(h => h.includes("판매"));
    if (iPrice < 0) iPrice = head.length - 1;
    let n = 0;
    lines.slice(1).forEach(c => {
      const name = c[iName], v = Math.round(Number(String(c[iPrice]).replace(/[^\d.]/g, "")));
      if (name in draft && v > 0) { draft[name] = v; n++; }
    });
    e.target.value = "";
    render();
    toast(n ? `${n}개 키트 단가를 불러왔어요. 확인 후 저장하세요.` : "불러올 수 있는 단가가 없어요. (키트명, 판매 단가 열 필요)");
  };
})();
