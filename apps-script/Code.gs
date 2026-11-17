/**
 * 오픈더쉐어 홈페이지 접수용 Google Apps Script
 * - 홈페이지에서 보낸 견적신청(order) / 선생님 의견(voc) / 수업 후기(feedback)를
 *   이 스크립트가 연결된 구글 시트의 탭별로 저장합니다.
 * - 후기 탭의 'approved' 칸에 Y 를 입력하면 홈페이지 후기 목록에 노출됩니다.
 * 설치 방법은 README.md 참고.
 */

const NOTIFY_EMAIL = ""; // 새 접수 알림 받을 이메일 (비우면 알림 없음)

// 관리자 페이지(admin.html) 비밀번호. 반드시 바꿔서 쓰세요! (서버에서만 확인하므로 홈페이지 코드에 노출되지 않습니다)
const ADMIN_KEY = "여기에-관리자-비밀번호";
const PRICE_SHEET = "단가";

const SHEETS = {
  order:    { name: "견적·구매신청", cols: ["submittedAt","status","school","name","phone","email","programType","grade","schedule","instructor","donationLink","payment","items","totalQty","estimate","memo"] },
  voc:      { name: "선생님의견(VOC)", cols: ["submittedAt","status","topic","interests","level","budget","message","school","contact"] },
  feedback: { name: "수업후기", cols: ["submittedAt","approved","kit","overall","difficulty","engagement","sharing","target","again","comment","school","publish"] },
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);

    // ---- 관리자: 로그인 확인 / 단가 저장 ----
    if (data.type === "auth") return json({ ok: isAdmin_(data.key) });
    if (data.type === "prices") {
      if (!isAdmin_(data.key)) return json({ ok: false, error: "unauthorized" });
      savePrices_(data.prices || {});
      return json({ ok: true, savedAt: new Date().toISOString() });
    }

    const def = SHEETS[data.type];
    if (!def) return json({ ok: false, error: "unknown type" });
    const sh = sheet_(def);
    const row = def.cols.map(c => {
      if (c === "status") return "신규";
      if (c === "approved") return "";
      const v = data[c];
      return typeof v === "boolean" ? (v ? "Y" : "N") : (v ?? "");
    });
    sh.appendRow(row);
    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, `[홈페이지] 새 ${def.name} 접수`, def.cols.map((c, i) => `${c}: ${row[i]}`).join("\n"));
    }
    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// GET ?type=feedback → 승인(approved=Y) & 공개동의 후기만 반환 (연락처 등 제외)
function doGet(e) {
  if ((e.parameter.type || "") === "prices") return json(readPrices_());
  if ((e.parameter.type || "") !== "feedback") return json([]);
  const def = SHEETS.feedback;
  const sh = sheet_(def);
  const values = sh.getDataRange().getValues().slice(1);
  const idx = Object.fromEntries(def.cols.map((c, i) => [c, i]));
  const out = values
    .filter(r => String(r[idx.approved]).toUpperCase() === "Y" && String(r[idx.publish]).toUpperCase() !== "N")
    .reverse().slice(0, 30)
    .map(r => ({ kit: r[idx.kit], overall: Number(r[idx.overall]) || 0, comment: r[idx.comment], school: r[idx.school], target: r[idx.target] }));
  return json(out);
}

function isAdmin_(key) {
  return ADMIN_KEY && ADMIN_KEY !== "여기에-관리자-비밀번호" && String(key || "") === ADMIN_KEY;
}

// '단가' 탭: A열 키트명, B열 단가, C열 수정일시 (시트에서 직접 고쳐도 홈페이지에 반영됩니다)
function savePrices_(prices) {
  const sh = sheet_({ name: PRICE_SHEET, cols: ["kit", "price", "updatedAt"] });
  const now = new Date();
  const rows = Object.keys(prices)
    .filter(k => Number(prices[k]) > 0)
    .map(k => [k, Math.round(Number(prices[k])), now]);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

function readPrices_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(PRICE_SHEET);
  if (!sh) return {};
  const out = {};
  sh.getDataRange().getValues().slice(1).forEach(r => { if (r[0] && Number(r[1]) > 0) out[r[0]] = Number(r[1]); });
  return out;
}

function sheet_(def) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.appendRow(def.cols);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, def.cols.length).setFontWeight("bold").setBackground("#e7f4e3");
  }
  return sh;
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
