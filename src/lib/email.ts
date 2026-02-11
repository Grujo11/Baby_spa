import nodemailer from "nodemailer";
import { APP_URL } from "@/lib/config";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? "Baby Spa <no-reply@babyspa.local>";

function getTransport() {
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

export async function sendEmail(payload: EmailPayload) {
  const transport = getTransport();
  if (!transport) {
    console.log("[email:dry-run]", payload.subject, payload.to);
    return;
  }

  await transport.sendMail({
    from: smtpFrom,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}

export async function sendVerificationEmail(email: string, token: string) {
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

export async function sendLoginEmail(email: string, token: string) {
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

export async function sendReservationConfirmationEmail(
  email: string,
  dateLabel: string,
  timeLabel: string,
  cancelUrl: string
) {
  await sendEmail({
    to: email,
    subject: "Potvrda rezervacije - Baby Spa",
    html: `
      <p>Rezervacija je uspesno zakazana.</p>
      <p><strong>${dateLabel}</strong> u <strong>${timeLabel}</strong></p>
      <p>Ako zelis da otkazes termin:</p>
      <p><a href="${cancelUrl}">Otkazi termin</a></p>
    `,
  });
}

export async function sendReservationCanceledEmail(
  email: string,
  dateLabel: string,
  timeLabel: string
) {
  await sendEmail({
    to: email,
    subject: "Otkazivanje rezervacije - Baby Spa",
    html: `
      <p>Tvoja rezervacija je otkazana.</p>
      <p><strong>${dateLabel}</strong> u <strong>${timeLabel}</strong></p>
    `,
  });
}

export async function sendReminderEmail(
  email: string,
  dateLabel: string,
  timeLabel: string
) {
  await sendEmail({
    to: email,
    subject: "Podsetnik - Baby Spa",
    html: `
      <p>Podsetnik za termin za 2 sata.</p>
      <p><strong>${dateLabel}</strong> u <strong>${timeLabel}</strong></p>
    `,
  });
}
