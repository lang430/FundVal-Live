/**
 * Email notification service
 * Replaces Python smtplib with HTTP-based email API
 * Supports: Resend, Mailgun, SendGrid, or custom SMTP relay
 */

import { decryptValue } from '../crypto.js';

/**
 * Send notification email via HTTP API
 */
export async function sendNotificationEmail(env, to, data) {
  const { fundCode, fundName, estRate, reason, estimate, nav } = data;

  const subject = `[FundVal] ${fundName}(${fundCode}) 估值提醒`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
        📊 基金估值提醒
      </h2>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>基金名称:</strong> ${fundName}</p>
        <p style="margin: 4px 0;"><strong>基金代码:</strong> ${fundCode}</p>
        <p style="margin: 4px 0;"><strong>昨日净值:</strong> ${nav}</p>
        <p style="margin: 4px 0;"><strong>实时估值:</strong> ${estimate}</p>
        <p style="margin: 4px 0; color: ${estRate >= 0 ? '#16a34a' : '#dc2626'};">
          <strong>估值涨跌:</strong> ${estRate >= 0 ? '+' : ''}${estRate}%
        </p>
      </div>
      <p style="color: #666; background: #fef3c7; padding: 12px; border-radius: 6px;">
        ⚠️ <strong>触发原因:</strong> ${reason}
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        FundVal-Live 基金估值系统 · 此邮件为自动发送
      </p>
    </div>
  `;

  await sendEmail(env, to, subject, html);
}

/**
 * Send email via configured provider
 */
async function sendEmail(env, to, subject, html) {
  const emailProvider = env.EMAIL_PROVIDER || 'resend';

  try {
    switch (emailProvider.toLowerCase()) {
      case 'resend':
        await sendViaResend(env, to, subject, html);
        break;
      case 'mailgun':
        await sendViaMailgun(env, to, subject, html);
        break;
      case 'sendgrid':
        await sendViaSendGrid(env, to, subject, html);
        break;
      default:
        console.warn(`Unknown email provider: ${emailProvider}`);
    }
  } catch (e) {
    console.error(`Email send failed: ${e.message}`);
    throw e;
  }
}

async function sendViaResend(env, to, subject, html) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || 'FundVal <noreply@fundval.live>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend API error: ${resp.status} ${err}`);
  }
}

async function sendViaMailgun(env, to, subject, html) {
  const apiKey = env.MAILGUN_API_KEY;
  const domain = env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN required');

  const form = new FormData();
  form.append('from', env.EMAIL_FROM || `FundVal <noreply@${domain}>`);
  form.append('to', to);
  form.append('subject', subject);
  form.append('html', html);

  const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa('api:' + apiKey)}`,
    },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Mailgun API error: ${resp.status} ${err}`);
  }
}

async function sendViaSendGrid(env, to, subject, html) {
  const apiKey = env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY not configured');

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.EMAIL_FROM || 'noreply@fundval.live' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`SendGrid API error: ${resp.status} ${err}`);
  }
}
