# Contact form → Telegram

Every request from the form on the site (Ukrainian and English pages) goes to a Telegram chat through a bot.
Same setup as our other Vercel sites (Vektrum, diva-agency `api/lead.js`).

```
Visitor's browser  →  /api/lead (Vercel function, api/lead.js)  →  Telegram chat
                              ↑
              TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (Vercel settings, never in code)
```

The bot token lives only in Vercel's settings and **never reaches the browser**.

| Piece | File |
|---|---|
| Form (sends to `/api/lead`) | `index.html`, `<form id="lead-form" data-endpoint="/api/lead">` |
| Server handler | `api/lead.js` |
| Local test server (runs `/api/lead` too) | `serve.mjs`, reads secrets from `.env.local` |

---

## Setup (about 10 minutes)

### 1. Bot

Telegram → [@BotFather](https://t.me/BotFather) → `/newbot` → name, e.g. *UGP Leads*, and a username ending in `bot`.
BotFather replies with the **token** (`1234567890:AAH…`). Keep it private.

### 2. Chat that receives the requests

1. Create a Telegram group (e.g. *UGP — Запити*) and add the bot to it.
2. Send any message in the group, e.g. `hi`.
3. Open in the browser (replace `TOKEN`): `https://api.telegram.org/botTOKEN/getUpdates`
4. Find `"chat":{"id":-100…` — that number, **with the minus**, is the chat ID.

For requests to one person instead of a group: open the bot, press **Start**, then use `getUpdates` the same way;
the ID is a positive number.

> `getUpdates` is empty? The bot may have privacy mode on: in BotFather → `/setprivacy` → *Disable*, then send a new message in the group.

### 3. Put both values into Vercel

1. vercel.com → project **ugp** → **Settings → Environment Variables**.
2. Add `TELEGRAM_BOT_TOKEN` = the token and `TELEGRAM_CHAT_ID` = the chat ID (environments: Production and Preview).
3. **Deployments → ⋯ on the latest → Redeploy.** Without a redeploy the variables are not picked up.

### 4. Check

1. Open **https://ugp-jade.vercel.app/api/lead?check=1** — it must show `"ready":true`.
   It asks Telegram whether the token works and the bot can see the chat; nothing is sent.
2. Fill in the form on the site and press **Надіслати запит** — the request appears in the chat.

| `check=1` shows | Meaning |
|---|---|
| `token_present: false` / `chat_id_present: false` | variable missing or no redeploy after adding it |
| `token_valid: false` | wrong or revoked token |
| `chat_reachable: false` | wrong chat ID, missing minus, or the bot is not in the group |
| `ready: true` | everything works |

"Дякуємо! Запит отримано" is **only** shown after Telegram confirmed the message, so requests can't be lost silently.
If sending fails, the visitor keeps what they typed and sees both phone numbers and the e-mail.

---

## What arrives in Telegram

```
📩 Новий запит — UGP

Ім’я: Іван Петренко
Телефон: +380 95 123 45 67
Завдання: Відновити зупинений проєкт

Опис:
Зупинене будівництво в Києві, потрібна оцінка.

Мова сайту: українська (UA)
Коли: 09.11.26, 13:14 (Київ)
Сторінка: https://ugp-jade.vercel.app/?utm_source=fb

[ Написати в Telegram ] [ WhatsApp ]
```

The page address keeps its UTM tags, so you can see which ad a lead came from.
The phone number in the message is tappable; the buttons open a chat with the visitor's number
(Telegram only if the visitor allows finding them by number).

---

## Protection

- **Token stays on the server.** The page only calls `/api/lead`.
- **Bot trap.** A hidden `website` field: people don't see it, spam bots fill it. Such requests are dropped silently.
- **Rate limit.** At most 5 requests per IP per 10 minutes, then "Забагато запитів…". Kept in memory, so it stops floods
  rather than being a strict guarantee.
- **Validation.** Name, a real phone number (9–15 digits) and consent are required, same rules as on the page;
  everything is trimmed and HTML-escaped.

## Errors

Vercel → project → **Logs** (filter by `/api/lead`).

| Log line | Cause |
|---|---|
| `TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set` | variables missing, or no redeploy |
| `Telegram rejected the message: chat not found` | wrong chat ID, missing minus, bot removed from the group |
| `… Forbidden: bot was blocked` / `kicked` | the bot was blocked or removed |
| `Could not reach Telegram` | temporary network problem on Telegram's side |

## Testing locally

Create `.env.local` in the project root (it is git-ignored):

```
TELEGRAM_BOT_TOKEN=1234567890:AAH...
TELEGRAM_CHAT_ID=-1001234567890
```

Then `PORT=3100 node serve.mjs` and use the form at http://localhost:3100 — requests go to the real chat.

## If the token leaks

@BotFather → `/revoke` → choose the bot → it issues a new token and the old one stops working immediately.
Put the new token into Vercel and redeploy.
