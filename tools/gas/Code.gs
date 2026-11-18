/**
 * 콜로니 2126 · 정착촌 헌장 받기 (Google Apps Script)
 *
 * 학생이 엔딩에서 「헌장 완성!」을 누르면 이 웹 앱으로 결과가 오고, 시트에 한 줄씩 쌓인다.
 * 만드는 법은 같은 폴더의 README.md를 보세요.
 */
const SHEET_NAME = '헌장';
const HEADERS = ['받은 시각', '이름(번호)', '제6조 · 세계 시민으로서 나는', '등급', '증거 정확도(%)', '맞힘', '시도',
                 '레벨', '클리어 시간', '난이도', '운동 배지', '게임 속 날짜'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
    sh.appendRow([
      new Date(), clean_(d.name, 30), clean_(d.article6, 120), clean_(d.grade, 20),
      num_(d.acc), num_(d.right), num_(d.total), num_(d.level),
      clean_(d.time, 12), clean_(d.difficulty, 6), num_(d.badges), clean_(d.date, 20)
    ]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 주소를 브라우저로 열어 보면 켜져 있는지 알 수 있다
function doGet() {
  return ContentService.createTextOutput('콜로니 2126 헌장 받는 곳이 켜져 있어요.');
}

// 학생이 쓴 글이 수식(= + - @로 시작)으로 바뀌지 않게 하고, 너무 길면 자른다
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num_(v) { const n = Number(v); return isFinite(n) ? n : ''; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
