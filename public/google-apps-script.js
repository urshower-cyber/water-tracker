/**
 * 飲水紀錄 App - Google Apps Script Web App
 *
 * 部署方式：
 * 1. 開一份新的 Google Sheet
 * 2. 上方選單「擴充功能」→「Apps Script」
 * 3. 把這個檔案的內容整個貼進去，取代原本的程式碼
 * 4. 點「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    - 執行身分：我
 *    - 誰可以存取：任何人
 * 5. 部署後複製「網頁應用程式」的網址，貼到 App 設定裡的「Google Sheets 備份網址」
 *
 * 如果啟用了「推播通知」功能，這份程式同時會多存一個「推播訂閱」分頁，
 * 用來讓 Vercel 排程功能讀取誰、在什麼時間該收到通知。
 */

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  if (data.kind === 'subscription') {
    saveSubscription(data);
    return jsonOutput({ status: 'ok' });
  }

  if (data.kind === 'mark-fired') {
    markFired(data);
    return jsonOutput({ status: 'ok' });
  }

  // 預設：每日飲水紀錄同步
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let rawSheet = ss.getSheetByName('原始資料');
  if (!rawSheet) rawSheet = ss.insertSheet('原始資料');
  rawSheet.clear();
  rawSheet.getRange(1, 1).setValue('最後同步時間');
  rawSheet.getRange(1, 2).setValue(new Date());
  rawSheet.getRange(2, 1).setValue('資料 JSON');
  rawSheet.getRange(2, 2).setValue(JSON.stringify(data));

  let logSheet = ss.getSheetByName('每日紀錄');
  if (!logSheet) {
    logSheet = ss.insertSheet('每日紀錄');
    logSheet.appendRow(['日期', '總飲水量(cc)', '目標(cc)', '達成率', '筆數']);
  }

  const existingDates = logSheet.getDataRange().getValues().map(row => row[0]);

  function upsertDay(day) {
    const rate = day.goal > 0 ? Math.round((day.total / day.goal) * 100) + '%' : '';
    const rowData = [day.date, day.total, day.goal, rate, (day.entries || []).length];
    const idx = existingDates.indexOf(day.date);
    if (idx > 0) {
      logSheet.getRange(idx + 1, 1, 1, rowData.length).setValues([rowData]);
    } else {
      logSheet.appendRow(rowData);
    }
  }

  if (data.today) upsertDay(data.today);
  if (Array.isArray(data.history)) {
    data.history.forEach(upsertDay);
  }

  return jsonOutput({ status: 'ok' });
}

function doGet(e) {
  if (e.parameter.mode === 'subscriptions') {
    return jsonOutput(getAllSubscriptions());
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('原始資料');
  if (!rawSheet) return jsonOutput({});
  const json = rawSheet.getRange(2, 2).getValue();
  return jsonOutput(json ? JSON.parse(json) : {});
}

/* ---------- 推播訂閱相關 ---------- */

function getSubSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('推播訂閱');
  if (!sheet) {
    sheet = ss.insertSheet('推播訂閱');
    sheet.appendRow(['endpoint', 'subscriptionJSON', 'remindersJSON', 'goal', 'date', 'firedTodayJSON']);
  }
  return sheet;
}

function saveSubscription(data) {
  const sheet = getSubSheet();
  const rows = sheet.getDataRange().getValues();
  const endpoint = data.subscription.endpoint;
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === endpoint) { rowIndex = i + 1; break; }
  }
  const rowData = [
    endpoint,
    JSON.stringify(data.subscription),
    JSON.stringify(data.reminders || []),
    data.goal || 2000,
    todayInTaipei(),
    JSON.stringify([]),
  ];
  if (rowIndex > 0) {
    // 保留原本的 firedToday（同一天內不要因為更新設定就重置）
    const prevDate = rows[rowIndex - 1][4];
    const prevFired = rows[rowIndex - 1][5];
    if (prevDate === todayInTaipei()) {
      rowData[5] = prevFired;
    }
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function markFired(data) {
  const sheet = getSubSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.endpoint) {
      let fired = [];
      try { fired = JSON.parse(rows[i][5] || '[]'); } catch (err) { fired = []; }
      fired.push(data.fireKey);
      sheet.getRange(i + 1, 5).setValue(todayInTaipei());
      sheet.getRange(i + 1, 6).setValue(JSON.stringify(fired));
      break;
    }
  }
}

function getAllSubscriptions() {
  const sheet = getSubSheet();
  const rows = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const [endpoint, subJson, remindersJson, goal, date, firedJson] = rows[i];
    if (!endpoint) continue;
    let subscription, reminders, firedToday;
    try { subscription = JSON.parse(subJson); } catch (e) { continue; }
    try { reminders = JSON.parse(remindersJson); } catch (e) { reminders = []; }
    try { firedToday = date === todayInTaipei() ? JSON.parse(firedJson || '[]') : []; } catch (e) { firedToday = []; }
    list.push({ endpoint, subscription, reminders, goal, firedToday });
  }
  return list;
}

function todayInTaipei() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
