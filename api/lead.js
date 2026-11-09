/* ============================================================================
   UGP — contact form → Telegram  (Vercel serverless function: /api/lead)
   ============================================================================
   Same setup as on our previous Vercel sites (Vektrum, diva-agency api/lead.js).

   SETTINGS (Vercel → Project → Settings → Environment Variables, NOT in code):
     TELEGRAM_BOT_TOKEN   — token from @BotFather, e.g. 1234567890:AAH...
     TELEGRAM_CHAT_ID     — chat to post to; groups are negative: -1001234567890
   Then Deployments → Redeploy, otherwise the variables are not picked up.

   The token never reaches the browser: the page only talks to this address,
   and this function talks to Telegram. Full guide: TELEGRAM_SETUP.md
   ============================================================================ */

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// trim everything that comes from the browser, against accidental walls of text and junk
const clean = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);

/* Protection against a flood of requests from one address. It lives in the
   memory of the instance, so it is the best possible without a database rather
   than a strict guarantee — but it stops anyone filling the chat in a minute. */
const HITS = new Map();
function rateLimited(ip, max = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { HITS.set(ip, recent); return true; }
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 5000) HITS.clear();
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  const isCheck = req.method === 'GET' && /[?&]check=1\b/.test(req.url || '');
  if (req.method !== 'POST' && !isCheck) {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
             || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ ok: false, error: 'too_many_requests' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const api = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';   // override only for local tests

  /* Self-check: open /api/lead?check=1 after setup. Asks Telegram whether the token works
     and the bot can see the chat; sends nothing and reveals no names or ids. */
  if (isCheck) {
    const ask = (method, params = {}) => fetch(`${api}/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    }).then((r) => r.json()).catch(() => ({ ok: false }));
    const configured = Boolean(token && chatId);
    const tokenOk = configured && (await ask('getMe')).ok === true;
    const chatOk = tokenOk && (await ask('getChat', { chat_id: chatId })).ok === true;
    res.status(200).json({ token_present: Boolean(token), chat_id_present: Boolean(chatId), token_valid: tokenOk, chat_reachable: chatOk, ready: chatOk });
    return;
  }

  if (!token || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set');
    res.status(500).json({ ok: false, error: 'not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  // Bot trap: the field is hidden from people, so only a spammer's autofill fills it.
  // Answer "ok" so the bot does not keep trying.
  if (clean(body.website)) { res.status(200).json({ ok: true }); return; }

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const topic = clean(body.topic, 160);
  const message = clean(body.message, 3000);
  const digits = phone.replace(/\D/g, '');

  // same rules as the form on the page
  const missing = [];
  if (name.length < 2) missing.push('name');
  if (!/^[+\d\s().-]+$/.test(phone) || digits.length < 9 || digits.length > 15) missing.push('phone');
  if (body.consent !== true) missing.push('consent');
  if (missing.length) {
    res.status(400).json({ ok: false, error: 'missing_fields', missing });
    return;
  }

  const lang = clean(body.lang, 5) === 'en' ? 'англійська (EN)' : 'українська (UA)';
  const page = clean(body.page, 300);
  const when = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date());

  const text = [
    '📩 <b>Новий запит — UGP</b>',
    '',
    `<b>Ім’я:</b> ${escapeHtml(name)}`,
    `<b>Телефон:</b> ${escapeHtml(phone)}`,
    `<b>Завдання:</b> ${topic ? escapeHtml(topic) : '—'}`,
    message ? `\n<b>Опис:</b>\n${escapeHtml(message)}` : null,
    '',
    `<i>Мова сайту:</i> ${lang}`,
    `<i>Коли:</i> ${when} (Київ)`,
    page ? `<i>Сторінка:</i> ${escapeHtml(page)}` : null,
    // filter(Boolean) would also drop the intentional '' spacer lines — drop only nulls
  ].filter((line) => line !== null).join('\n');

  // One-tap replies. Telegram buttons accept only http(s) links, so no tel: — the number
  // in the text is already tappable. t.me/+<number> opens the visitor's Telegram, if they allow it.
  const intl = digits.length === 10 && digits.startsWith('0') ? '38' + digits : digits;
  const buttons = intl.length >= 11 ? [[
    { text: 'Написати в Telegram', url: `https://t.me/+${intl}` },
    { text: 'WhatsApp', url: `https://wa.me/${intl}` },
  ]] : null;

  const send = (markup) => fetch(`${api}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
      ...(markup ? { reply_markup: { inline_keyboard: markup } } : {}),
    }),
  }).then((r) => r.json());

  try {
    let result = await send(buttons);
    // Telegram rejects some button links — the request must still arrive
    if (!result.ok && /button|url/i.test(result.description || '')) result = await send(null);
    if (!result.ok) {
      // Telegram's description is very helpful: "chat not found", "bot was blocked", etc.
      console.error('Telegram rejected the message:', result.description);
      res.status(502).json({ ok: false, error: 'telegram_rejected' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Could not reach Telegram:', err);
    res.status(502).json({ ok: false, error: 'telegram_unreachable' });
  }
};
