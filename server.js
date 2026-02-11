const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const BOOKING_WINDOW_DAYS = 7;
const SESSION_COOKIE_NAME = "bs_session";
const SESSION_TTL_DAYS = 7;
const TOKEN_TTL_MINUTES = 30;
const PUBLIC_DIR = path.join(__dirname, "public");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("[db] unexpected error", err);
});

const dateFormatter = new Intl.DateTimeFormat("sr-RS", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("sr-RS", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDateOnlyString(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function parseTimeStringToParts(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || "0");
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function normalizeTimeString(value) {
  const parts = parseTimeStringToParts(value);
  if (!parts) return null;
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const second = String(parts.second).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}

function parseTimeToMinutes(value) {
  const parts = parseTimeStringToParts(value);
  if (!parts) return null;
  return parts.hour * 60 + parts.minute;
}

function combineDateAndTime(dateValue, timeValue) {
  const dateString = toDateOnlyString(dateValue);
  const parsedDate = parseDateOnly(dateString);
  const timeParts = parseTimeStringToParts(typeof timeValue === "string" ? timeValue : String(timeValue || ""));
  if (!parsedDate || !timeParts) return null;

  const result = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    0
  );
  if (Number.isNaN(result.getTime())) return null;
  return result;
}

function formatDateLabel(date) {
  const value = dateFormatter.format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimeLabel(date) {
  return timeFormatter.format(date);
}

function withinBookingWindow(date) {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + BOOKING_WINDOW_DAYS - 1);
  return date >= start && date <= end;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const pairs = header.split(";").map((part) => part.trim().split("="));
  const cookies = {};
  for (const [key, value] of pairs) {
    cookies[key] = decodeURIComponent(value || "");
  }
  return cookies;
}

function setCookie(res, name, value, options) {
  let cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; HttpOnly`;
  if (options?.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  if (options?.secure) {
    cookie += "; Secure";
  }
  res.setHeader("Set-Cookie", cookie);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  return map[ext] || "application/octet-stream";
}

async function serveFile(res, filePath) {
  try {
    const content = await fs.promises.readFile(filePath);
    res.writeHead(200, { "Content-Type": `${getContentType(filePath)}; charset=utf-8` });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function parseBody(req, rawBody) {
  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return rawBody ? JSON.parse(rawBody) : {};
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  }
  return {};
}

function getTransport() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendEmail(payload) {
  const transport = getTransport();
  if (!transport) {
    console.log("[email:dry-run]", payload.subject, payload.to);
    return;
  }

  const smtpFrom = process.env.SMTP_FROM || "Baby Spa <no-reply@babyspa.local>";

  await transport.sendMail({
    from: smtpFrom,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Potvrda naloga - Baby Spa",
    html: `
      <p>Zdravo,</p>
      <p>Klikni na link da potvrdis nalog:</p>
      <p><a href="${verifyUrl}">Potvrdi nalog</a></p>
      <p>Ako nisi ti, ignorisi ovaj mejl.</p>
    `,
  });
}

async function sendLoginEmail(email, token) {
  const loginUrl = `${APP_URL}/api/auth/login?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Prijava - Baby Spa",
    html: `
      <p>Zdravo,</p>
      <p>Klikni na link da se prijavis:</p>
      <p><a href="${loginUrl}">Prijava</a></p>
    `,
  });
}

async function sendReservationConfirmationEmail(email, dateLabel, timeLabel, cancelUrl, babyLabel) {
  await sendEmail({
    to: email,
    subject: "Potvrda rezervacije - Baby Spa",
    html: `
      <p>Rezervacija je uspesno zakazana.</p>
      <p><strong>${dateLabel}</strong> u <strong>${timeLabel}</strong></p>
      ${babyLabel ? `<p><strong>${babyLabel}</strong></p>` : ""}
      <p>Ako zelis da otkazes termin:</p>
      <p><a href="${cancelUrl}">Otkazi termin</a></p>
    `,
  });
}

async function sendReservationCanceledEmail(email, dateLabel, timeLabel) {
  await sendEmail({
    to: email,
    subject: "Otkazivanje rezervacije - Baby Spa",
    html: `
      <p>Tvoja rezervacija je otkazana.</p>
      <p><strong>${dateLabel}</strong> u <strong>${timeLabel}</strong></p>
    `,
  });
}

async function sendReminderEmail(email, dateLabel, timeLabel) {
  await sendEmail({
    to: email,
    subject: "Podsetnik - Baby Spa",
    html: `
      <p>Podsetnik za termin za 2 sata.</p>
      <p><strong>${dateLabel}</strong> u <strong>${timeLabel}</strong></p>
    `,
  });
}

async function createEmailVerificationToken(userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  await pool.query(
    "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );
  return token;
}

async function createLoginToken(userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  await pool.query(
    "INSERT INTO login_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );
  return token;
}

async function createSession(res, userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );

  setCookie(res, SESSION_COOKIE_NAME, token, {
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

async function getSessionUser(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT u.id, u.email, u.email_verified_at, u.first_name, u.last_name, u.phone, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

function isAdmin(user) {
  return String(user?.role || "").toUpperCase() === "ADMIN";
}

async function generateSlotsForWorkDay(workDay) {
  if (!workDay || workDay.is_closed || !workDay.start_time || !workDay.end_time) return 0;

  const dateStr = toDateOnlyString(workDay.work_date);
  const start = combineDateAndTime(dateStr, workDay.start_time);
  const end = combineDateAndTime(dateStr, workDay.end_time);

  if (!dateStr || !start || !end || start >= end) {
    throw new Error("Neispravno radno vreme dana.");
  }

  let current = new Date(start);
  let created = 0;

  while (current < end) {
    const next = new Date(current.getTime() + 60 * 60 * 1000);
    if (next > end) break;

    const insertResult = await pool.query(
      `INSERT INTO time_slots (work_date, start_time, end_time, status, work_day_id)
       VALUES ($1, $2, $3, 'AVAILABLE', $4)
       ON CONFLICT (work_date, start_time) DO NOTHING`,
      [dateStr, current, next, workDay.id]
    );

    created += insertResult.rowCount || 0;
    current = next;
  }

  return created;
}

async function maybeEnsureSchema() {
  if (process.env.AUTO_SCHEMA !== "true") return;
  const schemaPath = path.join(__dirname, "sql", "schema.sql");
  if (!fs.existsSync(schemaPath)) return;
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
  await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS baby_name TEXT");
  await pool.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS baby_age_months INTEGER");
}

cron.schedule("*/5 * * * *", async () => {
  try {
    const result = await pool.query(
      `SELECT r.id as reservation_id, u.email, s.start_time
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       JOIN time_slots s ON s.id = r.slot_id
       WHERE r.status = 'ACTIVE'
         AND r.reminder_sent_at IS NULL
         AND s.start_time BETWEEN now() + interval '2 hours' AND now() + interval '2 hours 5 minutes'`
    );

    for (const row of result.rows) {
      const dateLabel = formatDateLabel(new Date(row.start_time));
      const timeLabel = formatTimeLabel(new Date(row.start_time));
      await sendReminderEmail(row.email, dateLabel, timeLabel);
      await pool.query("UPDATE reservations SET reminder_sent_at = now() WHERE id = $1", [row.reservation_id]);
    }
  } catch (err) {
    console.error("[cron]", err);
  }
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method || "GET";
    const cookies = parseCookies(req);

    if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!user) return redirect(res, "/login");
      if (isAdmin(user)) return redirect(res, "/admin");
      return serveFile(res, path.join(PUBLIC_DIR, "index.html"));
    }

    if (method === "GET" && (pathname === "/admin" || pathname === "/admin.html")) {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!user) return redirect(res, "/login");
      if (!isAdmin(user)) return redirect(res, "/");
      return serveFile(res, path.join(PUBLIC_DIR, "admin.html"));
    }

    if (method === "GET" && pathname === "/login") {
      return serveFile(res, path.join(PUBLIC_DIR, "login.html"));
    }

    if (method === "POST" && pathname === "/api/auth/request-access") {
      const body = parseBody(req, await readBody(req));
      const email = String(body.email || "").trim().toLowerCase();
      if (!validateEmail(email)) return redirect(res, "/login?error=1");

      try {
        const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        let user = existing.rows[0];

        if (!user) {
          const created = await pool.query("INSERT INTO users (email) VALUES ($1) RETURNING *", [email]);
          user = created.rows[0];
        }

        if (!user.email_verified_at) {
          const token = await createEmailVerificationToken(user.id);
          await sendVerificationEmail(user.email, token);
        } else {
          const token = await createLoginToken(user.id);
          await sendLoginEmail(user.email, token);
        }

        return redirect(res, "/login?sent=1");
      } catch (err) {
        console.error("[auth:request]", err);
        return redirect(res, "/login?error=1");
      }
    }

    if (method === "GET" && pathname === "/api/auth/verify") {
      const token = url.searchParams.get("token") || "";
      if (!token) return redirect(res, "/login?error=1");

      try {
        const tokenHash = hashToken(token);
        const result = await pool.query(
          `SELECT t.id, t.user_id, u.email_verified_at
           FROM email_verification_tokens t
           JOIN users u ON u.id = t.user_id
           WHERE t.token_hash = $1 AND t.expires_at > now() AND t.used_at IS NULL
           LIMIT 1`,
          [tokenHash]
        );

        const record = result.rows[0];
        if (!record) return redirect(res, "/login?error=1");

        await pool.query("UPDATE email_verification_tokens SET used_at = now() WHERE id = $1", [record.id]);
        await pool.query(
          "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1",
          [record.user_id]
        );

        await createSession(res, record.user_id);
        return redirect(res, "/");
      } catch (err) {
        console.error("[auth:verify]", err);
        return redirect(res, "/login?error=1");
      }
    }

    if (method === "GET" && pathname === "/api/auth/login") {
      const token = url.searchParams.get("token") || "";
      if (!token) return redirect(res, "/login?error=1");

      try {
        const tokenHash = hashToken(token);
        const result = await pool.query(
          `SELECT t.id, t.user_id
           FROM login_tokens t
           JOIN users u ON u.id = t.user_id
           WHERE t.token_hash = $1 AND t.expires_at > now() AND t.used_at IS NULL AND u.email_verified_at IS NOT NULL
           LIMIT 1`,
          [tokenHash]
        );

        const record = result.rows[0];
        if (!record) return redirect(res, "/login?error=1");

        await pool.query("UPDATE login_tokens SET used_at = now() WHERE id = $1", [record.id]);
        await createSession(res, record.user_id);
        return redirect(res, "/");
      } catch (err) {
        console.error("[auth:login]", err);
        return redirect(res, "/login?error=1");
      }
    }

    if (method === "GET" && pathname === "/api/me") {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!user) return sendJson(res, 401, { error: "Unauthorized" });
      return sendJson(res, 200, {
        email: user.email,
        emailVerifiedAt: user.email_verified_at,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
      });
    }

    if (method === "GET" && pathname === "/api/slots") {
      const dateValue = url.searchParams.get("date") || "";
      const date = parseDateOnly(dateValue);
      if (!date) return sendJson(res, 400, { error: "Neispravan datum." });
      if (!withinBookingWindow(date)) {
        return sendJson(res, 400, { error: "Datum nije u dozvoljenom periodu." });
      }

      try {
        let slotsResult = await pool.query(
          "SELECT id, start_time, end_time FROM time_slots WHERE work_date = $1 AND status = 'AVAILABLE' AND start_time > now() ORDER BY start_time",
          [dateValue]
        );

        if (slotsResult.rows.length === 0) {
          const workDayResult = await pool.query("SELECT * FROM work_days WHERE work_date = $1 LIMIT 1", [dateValue]);
          const workDay = workDayResult.rows[0];
          if (workDay) {
            await generateSlotsForWorkDay(workDay);
            slotsResult = await pool.query(
              "SELECT id, start_time, end_time FROM time_slots WHERE work_date = $1 AND status = 'AVAILABLE' AND start_time > now() ORDER BY start_time",
              [dateValue]
            );
          }
        }

        const slots = slotsResult.rows.map((slot) => ({
          id: slot.id,
          startTime: formatTimeLabel(new Date(slot.start_time)),
          endTime: formatTimeLabel(new Date(slot.end_time)),
        }));

        return sendJson(res, 200, { slots });
      } catch (err) {
        console.error("[slots]", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "POST" && pathname === "/api/reservations") {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!user) return sendJson(res, 401, { error: "Prijavi se." });

      const body = parseBody(req, await readBody(req));
      const slotId = String(body.slotId || "");
      const firstName = String(body.firstName || "").trim();
      const lastName = String(body.lastName || "").trim();
      const phone = String(body.phone || "").trim();
      const babyName = String(body.babyName || "").trim();
      const babyAgeMonthsRaw = String(body.babyAgeMonths || "").trim();
      const babyAgeMonths = Number(babyAgeMonthsRaw);
      const notes = String(body.notes || "").trim();

      if (!slotId || !firstName || !lastName || !phone || !babyName) {
        return sendJson(res, 400, { error: "Popuni sva obavezna polja." });
      }
      if (!Number.isInteger(babyAgeMonths) || babyAgeMonths < 0 || babyAgeMonths > 36) {
        return sendJson(res, 400, { error: "Starost bebe mora biti broj meseci (0-36)." });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const slotResult = await client.query(
          "SELECT id, start_time, end_time, work_date, status FROM time_slots WHERE id = $1 FOR UPDATE",
          [slotId]
        );
        const slot = slotResult.rows[0];
        if (!slot || slot.status !== "AVAILABLE") {
          await client.query("ROLLBACK");
          return sendJson(res, 400, { error: "Termin vise nije dostupan." });
        }
        if (new Date(slot.start_time) <= new Date()) {
          await client.query("ROLLBACK");
          return sendJson(res, 400, { error: "Termin je vec prosao." });
        }

        await client.query("UPDATE time_slots SET status = 'BOOKED' WHERE id = $1", [slotId]);

        const reservationResult = await client.query(
          `INSERT INTO reservations (user_id, slot_id, first_name, last_name, phone, baby_name, baby_age_months, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [user.id, slotId, firstName, lastName, phone, babyName, babyAgeMonths, notes || null]
        );

        const reservationId = reservationResult.rows[0].id;
        const cancelToken = generateToken();
        const cancelTokenHash = hashToken(cancelToken);
        const cancelExpiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

        await client.query(
          `INSERT INTO reservation_cancel_tokens (reservation_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [reservationId, cancelTokenHash, cancelExpiresAt]
        );

        await client.query(
          "UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = now() WHERE id = $4",
          [firstName, lastName, phone, user.id]
        );

        await client.query("COMMIT");

        const dateLabel = formatDateLabel(new Date(slot.start_time));
        const timeLabel = formatTimeLabel(new Date(slot.start_time));
        const cancelUrl = `${APP_URL}/api/reservations/cancel?token=${cancelToken}`;
        const babyLabel = `Beba: ${babyName}, ${babyAgeMonths} meseci`;

        await sendReservationConfirmationEmail(user.email, dateLabel, timeLabel, cancelUrl, babyLabel);

        return sendJson(res, 200, { ok: true });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("[reservation]", err);
        return sendJson(res, 500, { error: "Server error" });
      } finally {
        client.release();
      }
    }

    if (method === "GET" && pathname === "/api/reservations/cancel") {
      const token = url.searchParams.get("token") || "";
      if (!token) return sendHtml(res, 400, "Neispravan link.");

      const tokenHash = hashToken(token);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const result = await client.query(
          `SELECT t.id as token_id, r.id as reservation_id, u.email, s.start_time, s.id as slot_id
           FROM reservation_cancel_tokens t
           JOIN reservations r ON r.id = t.reservation_id
           JOIN users u ON u.id = r.user_id
           JOIN time_slots s ON s.id = r.slot_id
           WHERE t.token_hash = $1 AND t.expires_at > now() AND t.used_at IS NULL
           LIMIT 1`,
          [tokenHash]
        );

        const record = result.rows[0];
        if (!record) {
          await client.query("ROLLBACK");
          return sendHtml(res, 400, "Link za otkazivanje nije vazeci.");
        }

        await client.query(
          "UPDATE reservations SET status = 'CANCELED', canceled_at = now() WHERE id = $1",
          [record.reservation_id]
        );
        await client.query("UPDATE time_slots SET status = 'AVAILABLE' WHERE id = $1", [record.slot_id]);
        await client.query("UPDATE reservation_cancel_tokens SET used_at = now() WHERE id = $1", [record.token_id]);

        await client.query("COMMIT");

        const dateLabel = formatDateLabel(new Date(record.start_time));
        const timeLabel = formatTimeLabel(new Date(record.start_time));

        await sendReservationCanceledEmail(record.email, dateLabel, timeLabel);

        return sendHtml(
          res,
          200,
          "<html><body style='font-family:Arial,sans-serif;padding:40px'><h2>Termin je otkazan.</h2><p>Hvala.</p></body></html>"
        );
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("[cancel]", err);
        return sendHtml(res, 500, "Server error");
      } finally {
        client.release();
      }
    }

    if (method === "POST" && pathname === "/api/admin/work-days") {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!isAdmin(user)) return sendJson(res, 403, { error: "Niste admin." });

      const body = parseBody(req, await readBody(req));
      const workDate = String(body.workDate || "");
      const startTimeRaw = body.startTime ? String(body.startTime) : null;
      const endTimeRaw = body.endTime ? String(body.endTime) : null;
      const isClosed = body.isClosed === "true" || body.isClosed === true;

      const date = parseDateOnly(workDate);
      if (!date) return sendJson(res, 400, { error: "Neispravan datum." });

      let startTime = normalizeTimeString(startTimeRaw);
      let endTime = normalizeTimeString(endTimeRaw);

      if (isClosed) {
        startTime = null;
        endTime = null;
      } else {
        if (!startTime || !endTime) {
          return sendJson(res, 400, { error: "Unesi pocetak i kraj radnog vremena." });
        }
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
          return sendJson(res, 400, { error: "Kraj radnog vremena mora biti posle pocetka." });
        }
      }

      try {
        const result = await pool.query(
          `INSERT INTO work_days (work_date, start_time, end_time, is_closed, created_by_admin_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (work_date)
           DO UPDATE SET
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             is_closed = EXCLUDED.is_closed,
             created_by_admin_id = EXCLUDED.created_by_admin_id
           RETURNING *`,
          [workDate, startTime, endTime, isClosed, user.id]
        );

        if (isClosed) {
          await pool.query("UPDATE time_slots SET status = 'BLOCKED' WHERE work_date = $1 AND status = 'AVAILABLE'", [workDate]);
        }

        return sendJson(res, 200, { workDay: result.rows[0] });
      } catch (err) {
        console.error("[work-days]", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "GET" && pathname === "/api/admin/work-days") {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!isAdmin(user)) return sendJson(res, 403, { error: "Niste admin." });

      try {
        const result = await pool.query(
          `SELECT w.*, COUNT(s.id) as slot_count
           FROM work_days w
           LEFT JOIN time_slots s ON s.work_day_id = w.id
           GROUP BY w.id
           ORDER BY w.work_date ASC`
        );

        return sendJson(res, 200, { workDays: result.rows });
      } catch (err) {
        console.error("[work-days:list]", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "GET" && pathname === "/api/admin/reservations") {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!isAdmin(user)) return sendJson(res, 403, { error: "Niste admin." });

      const dateFilter = url.searchParams.get("date");
      if (dateFilter && !parseDateOnly(dateFilter)) {
        return sendJson(res, 400, { error: "Neispravan datum filtera." });
      }

      try {
        const result = await pool.query(
          `SELECT
             r.id,
             r.status,
             r.first_name,
             r.last_name,
             r.phone,
             r.baby_name,
             r.baby_age_months,
             r.notes,
             r.created_at,
             r.canceled_at,
             u.email,
             s.work_date,
             s.start_time,
             s.end_time
           FROM reservations r
           JOIN users u ON u.id = r.user_id
           JOIN time_slots s ON s.id = r.slot_id
           WHERE ($1::date IS NULL OR s.work_date = $1::date)
           ORDER BY s.work_date ASC, s.start_time ASC`,
          [dateFilter || null]
        );

        return sendJson(res, 200, { reservations: result.rows });
      } catch (err) {
        console.error("[admin:reservations]", err);
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "POST" && pathname.startsWith("/api/admin/work-days/") && pathname.endsWith("/generate-slots")) {
      const user = await getSessionUser(cookies[SESSION_COOKIE_NAME]);
      if (!isAdmin(user)) return sendJson(res, 403, { error: "Niste admin." });

      const id = pathname.split("/")[4];
      try {
        const result = await pool.query("SELECT * FROM work_days WHERE id = $1", [id]);
        const workDay = result.rows[0];
        if (!workDay) return sendJson(res, 404, { error: "Nema dana." });
        if (workDay.is_closed) return sendJson(res, 400, { error: "Dan je zatvoren." });
        if (!workDay.start_time || !workDay.end_time) {
          return sendJson(res, 400, { error: "Nema unetog radnog vremena za taj dan." });
        }

        const created = await generateSlotsForWorkDay(workDay);
        return sendJson(res, 200, { created });
      } catch (err) {
        console.error("[work-days:generate]", err);
        if (err && typeof err.message === "string" && err.message.includes("Neispravno radno vreme")) {
          return sendJson(res, 400, { error: "Neispravno radno vreme za izabrani dan." });
        }
        return sendJson(res, 500, { error: "Server error" });
      }
    }

    if (method === "GET") {
      const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
      const filePath = path.join(PUBLIC_DIR, safePath);
      if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return serveFile(res, filePath);
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    console.error("[server]", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error");
  }
});

maybeEnsureSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on ${APP_URL}`);
    });
  })
  .catch((err) => {
    console.error("[startup]", err);
    process.exit(1);
  });
