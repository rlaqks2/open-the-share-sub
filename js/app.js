(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = n => n.toLocaleString("ko-KR") + "원";
  const fmtTime = m => (m >= 60 ? Math.floor(m / 60) + "시간" : "") + (m % 60 ? " " + (m % 60) + "분" : "");
  const CFG = SITE_CONFIG;
  const DEMO = !CFG.ENDPOINT;
  const DEFAULT_QTY = 20;

  /* ---------- storage (안전하게) ---------- */
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  };

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- cart ---------- */
  let cart = store.get("ots_cart", {});
  const kitById = Object.fromEntries(KITS.map(k => [k.id, k]));
  Object.keys(cart).forEach(id => { if (!kitById[id]) delete cart[id]; });

  function saveCart() {
    store.set("ots_cart", cart);
    const n = Object.keys(cart).length;
    $("#cartCount").textContent = n;
    const b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    renderOrderItems(); renderDrawer(); syncAddButtons();
  }
  function toggleCart(id) {
    if (cart[id]) { delete cart[id]; toast(`${kitById[id].name}을(를) 뺐어요`); }
    else { cart[id] = DEFAULT_QTY; toast(`${kitById[id].name} 담았어요 · 수량은 견적서에서 조정`); }
    saveCart();
  }

  /* ---------- filters + kit grid ---------- */
  const state = { q: "", group: "전체", level: "", time: "", season: "" };
  const chipsEl = $("#groupChips");
  ["전체", ...Object.keys(GROUPS)].forEach(g => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = g;
    b.setAttribute("aria-pressed", g === "전체");
    b.onclick = () => { state.group = g; $$(".chip", chipsEl).forEach(c => c.setAttribute("aria-pressed", c === b)); renderKits(); };
    chipsEl.appendChild(b);
  });
  $("#q").addEventListener("input", e => { state.q = e.target.value.trim(); renderKits(); });
  $("#fLevel").onchange = e => { state.level = e.target.value; renderKits(); };
  $("#fTime").onchange = e => { state.time = e.target.value; renderKits(); };
  $("#fSeason").onchange = e => { state.season = e.target.value; renderKits(); };

  function priceHTML(k) {
    return k.price ? `<span class="price">${won(k.price)}<small> /1인</small></span>` : `<span class="price ask">견적 문의</span>`;
  }
  function renderKits() {
    const q = state.q.toLowerCase();
    const list = KITS.filter(k =>
      (state.group === "전체" || k.group === state.group) &&
      (!state.level || k.level === state.level) &&
      (!state.time || k.minutes === +state.time) &&
      (!state.season || k.season === state.season) &&
      (!q || (k.name + k.method + k.group + k.give).toLowerCase().includes(q))
    );
    $("#kitCount").textContent = list.length;
    $("#kitEmpty").hidden = list.length > 0;
    $("#kitGrid").innerHTML = list.map(k => `
      <article class="kit">
        <button class="kit-img" data-open="${k.id}" aria-label="${esc(k.name)} 자세히 보기">
          <img src="${k.img}" alt="${esc(k.name)}" loading="lazy">
          ${k.season ? `<span class="kit-season">${k.season}</span>` : ""}
        </button>
        <div class="kit-body">
          <h3>${esc(k.name)}</h3>
          <div class="meta"><span class="lv-${k.level}">난이도 ${k.level}</span><span>${fmtTime(k.minutes).trim()}</span><span>${k.method}</span></div>
          <p class="give">${esc(k.give)}</p>
          <div class="kit-foot">${priceHTML(k)}<button class="add" data-add="${k.id}">＋ 담기</button></div>
        </div>
      </article>`).join("");
    syncAddButtons();
  }
  function syncAddButtons() {
    $$("[data-add]").forEach(b => {
      const inCart = !!cart[b.dataset.add];
      b.classList.toggle("in", inCart);
      b.textContent = inCart ? "✓ 담음" : "＋ 담기";
    });
  }
  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { toggleCart(add.dataset.add); return; }
    const open = e.target.closest("[data-open]");
    if (open) openModal(open.dataset.open);
  });

  /* ---------- modal ---------- */
  const modal = $("#modal");
  function openModal(id) {
    const k = kitById[id];
    $("#modalBody").innerHTML = `
      <div class="md">
        <img src="${k.img}" alt="${esc(k.name)}">
        <div class="md-info">
          <p class="eyebrow">${esc(k.group)}</p>
          <h3>${esc(k.name)}</h3>
          <dl>
            <dt>난이도</dt><dd>${k.level}</dd>
            <dt>소요시간</dt><dd>${fmtTime(k.minutes).trim()}</dd>
            <dt>제작방식</dt><dd>${k.method}</dd>
            <dt>추천 나눔</dt><dd>${esc(k.give)}</dd>
            ${k.season ? `<dt>추천 계절</dt><dd>${k.season}</dd>` : ""}
            <dt>단가</dt><dd>${k.price ? won(k.price) + " / 1인" : "견적 문의"}</dd>
          </dl>
          <button class="btn ${cart[id] ? "btn-ghost" : "btn-primary"}" data-add="${id}" data-close>${cart[id] ? "✓ 담음 (빼기)" : "＋ 견적에 담기"}</button>
        </div>
      </div>`;
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
  $("#modalClose").onclick = closeModal;
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) setTimeout(closeModal, 0); });

  /* ---------- drawer ---------- */
  const drawer = $("#drawer");
  const openDrawer = () => { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); };
  const closeDrawer = () => { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); };
  $("#cartBtn").onclick = openDrawer;
  $("#drawerClose").onclick = closeDrawer;
  $("#drawerGo").onclick = closeDrawer;
  drawer.addEventListener("click", e => { if (e.target === drawer) closeDrawer(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

  function itemRow(k, withQty) {
    return `<div class="oi">
      <img src="${k.img}" alt="">
      <div><div class="n">${esc(k.name)}</div><div class="s">${k.method} · 난이도 ${k.level} · ${fmtTime(k.minutes).trim()}</div></div>
      ${withQty ? `<label class="qty">인원 <input type="number" min="1" max="2000" value="${cart[k.id]}" data-qty="${k.id}" aria-label="${esc(k.name)} 수량">명</label>` : `<span class="s">${cart[k.id]}명</span>`}
      <button type="button" class="rm" data-rm="${k.id}" aria-label="${esc(k.name)} 빼기">×</button>
    </div>`;
  }
  function renderDrawer() {
    const ids = Object.keys(cart);
    $("#drawerBody").innerHTML = ids.length ? ids.map(id => itemRow(kitById[id], false)).join("") : `<p class="hint">담은 키트가 없어요.</p>`;
  }
  function renderOrderItems() {
    const ids = Object.keys(cart);
    $("#orderItems").innerHTML = ids.map(id => itemRow(kitById[id], true)).join("");
    $("#orderEmpty").hidden = ids.length > 0;
    updateTotal();
  }
  function updateTotal() {
    const ids = Object.keys(cart);
    const el = $("#orderTotal");
    if (!ids.length) { el.hidden = true; return; }
    const people = ids.reduce((s, id) => s + (+cart[id] || 0), 0);
    const priced = ids.every(id => kitById[id].price);
    const sum = ids.reduce((s, id) => s + (kitById[id].price || 0) * (+cart[id] || 0), 0);
    el.hidden = false;
    el.innerHTML = `<span>${ids.length}종 · 총 ${people.toLocaleString()}개</span><span>${priced ? "예상 금액 " + won(sum) : "금액은 견적서로 안내드려요"}</span>`;
  }
  document.addEventListener("input", e => {
    const q = e.target.closest("[data-qty]");
    if (q) { cart[q.dataset.qty] = Math.max(1, +q.value || 1); store.set("ots_cart", cart); updateTotal(); renderDrawer(); }
  });
  document.addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { delete cart[rm.dataset.rm]; saveCart(); }
  });

  /* ---------- payment options ---------- */
  $("#payGrid").innerHTML = CFG.PAYMENT_METHODS.map((p, i) => `
    <label class="pay"><input type="radio" name="payment" value="${esc(p.label)}" ${i === 0 ? "checked" : ""}>
      <b>${esc(p.label)}</b><small>${esc(p.desc)}</small></label>`).join("");

  /* ---------- VOC interests / feedback kit select ---------- */
  $("#vocInterests").innerHTML = Object.keys(GROUPS).map(g =>
    `<label><input type="checkbox" name="interests" value="${esc(g)}"> ${esc(g)}</label>`).join("");
  $("#fbKit").insertAdjacentHTML("beforeend", KITS.map(k => `<option>${esc(k.name)}</option>`).join("") + `<option>기타 / 여러 키트</option>`);

  /* ---------- star ratings ---------- */
  const ratings = {};
  $$(".rate").forEach(r => {
    const name = r.dataset.name, box = $(".stars", r);
    ratings[name] = 0;
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "★"; b.setAttribute("aria-label", `${i}점`);
      b.onclick = () => { ratings[name] = i; $$("button", box).forEach((x, j) => x.classList.toggle("on", j < i)); };
      box.appendChild(b);
    }
  });
  const resetStars = () => $$(".rate").forEach(r => { ratings[r.dataset.name] = 0; $$(".stars button", r).forEach(x => x.classList.remove("on")); });

  /* ---------- submit ---------- */
  async function submit(type, payload) {
    const record = { type, submittedAt: new Date().toISOString(), page: location.href, ...payload };
    if (DEMO) {
      const all = store.get("ots_submissions", []); all.push(record); store.set("ots_submissions", all);
      console.info("[미리보기 모드] 제출 데이터:", record);
      await new Promise(r => setTimeout(r, 400));
      return { demo: true };
    }
    // Apps Script는 CORS 응답을 주지 않으므로 no-cors + text/plain 으로 전송
    await fetch(CFG.ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(record) });
    return { demo: false };
  }

  function validate(form) {
    let ok = true;
    $$("[required]", form).forEach(el => {
      const bad = el.type === "checkbox" ? !el.checked : !el.value.trim() || (el.type === "email" && !/^\S+@\S+\.\S+$/.test(el.value));
      el.classList.toggle("invalid", bad);
      if (bad && ok) { ok = false; el.focus(); }
    });
    return ok;
  }
  function formData(form) {
    const fd = new FormData(form), o = {};
    for (const [k, v] of fd.entries()) o[k] = o[k] ? [].concat(o[k], v) : v;
    $$("input[type=checkbox]", form).forEach(c => { if (!fd.has(c.name)) o[c.name] = false; else if (c.value === "on") o[c.name] = true; });
    if (Array.isArray(o.interests)) o.interests = o.interests.join(", ");
    return o;
  }
  function wire(form, type, build, after) {
    const msg = $(".form-msg", form), btn = $("button[type=submit]", form);
    form.addEventListener("input", e => e.target.classList?.remove("invalid"));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      msg.className = "form-msg"; msg.textContent = "";
      if (!validate(form)) { msg.classList.add("err"); msg.textContent = "필수 항목(*)을 확인해 주세요."; return; }
      const payload = build(formData(form));
      if (!payload) return;
      btn.disabled = true; const label = btn.textContent; btn.textContent = "보내는 중…";
      try {
        const r = await submit(type, payload);
        msg.classList.add("ok");
        msg.textContent = r.demo ? "미리보기 모드라 실제로 전송되지는 않았어요. (ENDPOINT 설정 후 실제 접수)" : "잘 받았습니다. 감사합니다!";
        after?.(payload);
        form.reset();
      } catch (err) {
        msg.classList.add("err"); msg.textContent = `전송에 실패했어요. ${CFG.ORG.email} 또는 ${CFG.ORG.tel}로 연락 주세요.`;
      } finally { btn.disabled = false; btn.textContent = label; }
    });
  }

  wire($("#orderForm"), "order", d => {
    const ids = Object.keys(cart);
    if (!ids.length) { const m = $("#orderForm .form-msg"); m.className = "form-msg err"; m.textContent = "키트를 1개 이상 담아 주세요."; location.hash = "#kits"; return null; }
    d.totalQty = ids.reduce((s, id) => s + +cart[id], 0);
    d.items = ids.map(id => `${kitById[id].name} × ${cart[id]}${kitById[id].price ? ` (@${kitById[id].price.toLocaleString()})` : ""}`).join(" / ");
    d.estimate = ids.every(id => kitById[id].price) ? ids.reduce((s, id) => s + kitById[id].price * +cart[id], 0) : "";
    delete d.agree;
    return d;
  }, () => { cart = {}; saveCart(); });

  wire($("#vocForm"), "voc", d => d);

  wire($("#fbForm"), "feedback", d => {
    if (!ratings.overall) { const m = $("#fbForm .form-msg"); m.className = "form-msg err"; m.textContent = "전체 만족도 별점을 선택해 주세요."; return null; }
    Object.assign(d, ratings);
    return d;
  }, d => {
    const mine = store.get("ots_my_feedback", []); mine.unshift({ ...d, at: Date.now() }); store.set("ots_my_feedback", mine.slice(0, 5));
    resetStars(); loadFeedback();
  });

  /* ---------- feedback list ---------- */
  const maskSchool = s => { s = String(s || "").trim(); if (!s) return "익명 학교"; const m = s.match(/(초등학교|중학교|고등학교|초|중|고)$/); return "○○" + (m ? m[0].replace("등학교", "").replace("학교", "") : ""); };
  const starStr = n => "★".repeat(n) + "☆".repeat(5 - n);
  function fbCard(f, mine) {
    return `<article class="fb">
      <div class="fb-top"><b>${esc(f.kit)}${mine ? '<span class="mine">내가 쓴 후기 · 검토 중</span>' : ""}</b><span class="st" aria-label="${f.overall}점">${starStr(+f.overall || 0)}</span></div>
      <p>${esc(f.comment)}</p>
      <small>${esc(maskSchool(f.school))}${f.target ? " · " + esc(f.target) : ""}</small>
    </article>`;
  }
  async function loadFeedback() {
    const mine = store.get("ots_my_feedback", []).filter(f => f.publish);
    let approved = [];
    if (!DEMO) {
      try { const r = await fetch(CFG.ENDPOINT + "?type=feedback"); if (r.ok) approved = await r.json(); } catch { }
    }
    const html = mine.map(f => fbCard(f, true)).join("") + (Array.isArray(approved) ? approved.map(f => fbCard(f, false)).join("") : "");
    $("#fbList").innerHTML = html || `<p class="fb-empty">아직 소개된 후기가 없어요.<br>첫 번째 후기를 남겨 주세요!</p>`;
  }

  /* ---------- misc ---------- */
  const O = CFG.ORG;
  $("#contactList").innerHTML = `
    <li><span>Tel</span><a href="tel:${O.tel}">${O.tel}</a></li>
    <li><span>Mobile</span><a href="tel:${O.mobile}">${O.mobile}</a></li>
    <li><span>E-mail</span><a href="mailto:${O.email}">${O.email}</a></li>
    <li><span>Add.</span>${esc(O.address)}</li>`;
  $("#year").textContent = new Date().getFullYear();
  $("#demoBadge").hidden = !DEMO;
  const menu = $("#menu");
  $("#burger").onclick = () => menu.classList.toggle("open");
  $$("a", menu).forEach(a => a.onclick = () => menu.classList.remove("open"));

  renderKits(); saveCart(); loadFeedback();
  loadPriceOverrides().then(() => { renderKits(); renderOrderItems(); });
  $("#cartBtn").classList.remove("bump");
})();
