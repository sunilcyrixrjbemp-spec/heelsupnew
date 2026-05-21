/**
 * Deploy as Web App (Anyone with link).
 * Set SHARED_TOKEN below and match with GOOGLE_APPSCRIPT_TOKEN env in Cloudflare.
 */
const SHARED_TOKEN = 'REPLACE_ME';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (!data || data.token !== SHARED_TOKEN) {
      return jsonResponse({ ok: false, error: 'Unauthorized token' }, 401);
    }

    if (!data.to || !data.subject || (!data.message && !data.html)) {
      return jsonResponse({ ok: false, error: 'Missing fields' }, 400);
    }

    MailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      htmlBody: data.html || data.message,
      body: data.message || 'HeelsUp Notification',
      name: data.app || 'HeelsUp'
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function jsonResponse(obj, status) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ status }, obj)))
    .setMimeType(ContentService.MimeType.JSON);
}