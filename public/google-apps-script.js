/**
 * 飲水紀錄 App - Google Apps Script Web App
 * 部署方式：
 * 1. 開一份新的 Google Sheet
 * 2. 上方選單「擴充功能」→「Apps Script」
 * 3. 把這個檔案的內容整個貼進去，取代原本的程式碼
 * 4. 點「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    - 執行身分：我
 *    - 誰可以存取：任何人
 * 5. 部署後複製「網頁應用程式」的網址，貼到 App 設定裡的「Google Sheets 備份網址」
 */

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = JSON.parse(e.postData.contents);

  // Sheet1：原始 JSON 備份（每次同步覆蓋最新一筆）
  let rawSheet = ss.getSheetByName('原始資料');
  if (!rawSheet) rawSheet = ss.insertSheet('原始資料');
  rawSheet.clear();
  rawSheet.getRange(1, 1).setValue('最後同步時間');
  rawSheet.getRange(1, 2).setValue(new Date());
  rawSheet.getRange(2, 1).setValue('資料 JSON');
  rawSheet.getRange(2, 2).setValue(JSON.stringify(data));

  // Sheet2：每日紀錄明細（可讀格式，逐日累加寫入）
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

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('原始資料');
  if (!rawSheet) {
    return ContentService.createTextOutput(JSON.stringify({}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const json = rawSheet.getRange(2, 2).getValue();
  return ContentService.createTextOutput(json || '{}')
    .setMimeType(ContentService.MimeType.JSON);
}
