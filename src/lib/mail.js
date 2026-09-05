import nodemailer from 'nodemailer';
import { prisma } from './db.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendCredentialsEmail(email, name, phone, plainPassword) {
  if (!email) return; // The booking schema allows email to be optional

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!settings?.emailEnabled) return;

  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: auto;">
      <h2 style="color: #1b4d8f;">Welcome to Lepamus Residency</h2>
      <p>Hello ${name},</p>
      <p>Your room booking has been approved. You can now access your student portal.</p>
      <div style="background: #f4f5f3; padding: 16px; border-radius: 5px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Sign in with:</strong> ${phone}</p>
        <p style="margin: 0;"><strong>Password:</strong> ${plainPassword}</p>
      </div>
      <p style="font-size: 13px; color: #5a6169;">
        You will be required to change this password the first time you log in.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Your Lepamus Residency Portal Access',
      html,
    });
  } catch (err) {
    console.error('Email failed to send:', err);
  }
}