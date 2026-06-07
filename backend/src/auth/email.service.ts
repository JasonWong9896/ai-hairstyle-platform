import { Injectable } from '@nestjs/common';
import { TLSSocket, connect as tlsConnect } from 'tls';

type VerificationEmail = {
  to: string;
  name: string | null;
  confirmUrl: string;
};

type PasswordResetEmail = {
  to: string;
  name: string | null;
  resetUrl: string;
  code: string;
};

type SalonBookingEmail = {
  to: string;
  recipientName: string | null;
  salonName: string;
  customerName: string;
  customerEmail: string;
  styleImageUrl: string | null;
  preferredDate: string;
  preferredTime: string;
};

@Injectable()
export class EmailService {
  private readonly webhookUrl = process.env.EMAIL_DELIVERY_WEBHOOK_URL;
  private readonly from =
    process.env.EMAIL_FROM ??
    'AI Hairstyle Platform <jason.wong9896@gmail.com>';
  private readonly smtpHost = process.env.SMTP_HOST;
  private readonly smtpPort = Number(process.env.SMTP_PORT ?? 465);
  private readonly smtpSecure = process.env.SMTP_SECURE !== 'false';
  private readonly smtpUser = process.env.SMTP_USER;
  private readonly smtpPass = process.env.SMTP_PASS;

  async sendVerificationEmail(message: VerificationEmail) {
    const subject = 'Confirm your AI Hairstyle Platform email';
    const text = [
      `Hello${message.name ? ` ${message.name}` : ''},`,
      '',
      'Please confirm your email address to finish creating your account:',
      message.confirmUrl,
      '',
      'This link expires in 24 hours.',
    ].join('\n');

    const html = [
      `<p>Hello${message.name ? ` ${escapeHtml(message.name)}` : ''},</p>`,
      '<p>Please confirm your email address to finish creating your account:</p>',
      `<p><a href="${escapeHtml(message.confirmUrl)}">Confirm email address</a></p>`,
      '<p>This link expires in 24 hours.</p>',
    ].join('');

    await this.deliver({
      to: message.to,
      subject,
      text,
      html,
      debugLabel: 'email verification',
      debug: { confirmUrl: message.confirmUrl },
    });
  }

  async sendPasswordResetEmail(message: PasswordResetEmail) {
    const subject = 'Reset your AI Hairstyle Platform password';
    const text = [
      `Hello${message.name ? ` ${message.name}` : ''},`,
      '',
      'Use this secure link to reset your password:',
      message.resetUrl,
      '',
      `Or enter this verification code: ${message.code}`,
      '',
      'This link and code expire in 30 minutes. If you did not request this, you can ignore this email.',
    ].join('\n');

    const html = [
      `<p>Hello${message.name ? ` ${escapeHtml(message.name)}` : ''},</p>`,
      '<p>Use this secure link to reset your password:</p>',
      `<p><a href="${escapeHtml(message.resetUrl)}">Reset password</a></p>`,
      `<p>Or enter this verification code: <strong>${escapeHtml(message.code)}</strong></p>`,
      '<p>This link and code expire in 30 minutes. If you did not request this, you can ignore this email.</p>',
    ].join('');

    await this.deliver({
      to: message.to,
      subject,
      text,
      html,
      debugLabel: 'password reset',
      debug: { resetUrl: message.resetUrl, code: message.code },
    });
  }

  async sendCustomerBookingCompletedEmail(message: SalonBookingEmail) {
    const subject = 'Salon booking request received';
    const styleText = selectedHairstyleText(message.styleImageUrl);
    const styleHtml = selectedHairstyleHtml(message.styleImageUrl);
    const text = [
      `Hello${message.recipientName ? ` ${message.recipientName}` : ''},`,
      '',
      `Your booking request for ${message.salonName} has been received.`,
      `Preferred date: ${message.preferredDate}`,
      `Preferred time: ${message.preferredTime}`,
      `Selected hairstyle: ${styleText}`,
      '',
      'The salon will follow up if more details are needed.',
    ].join('\n');

    const html = [
      `<p>Hello${message.recipientName ? ` ${escapeHtml(message.recipientName)}` : ''},</p>`,
      `<p>Your booking request for <strong>${escapeHtml(message.salonName)}</strong> has been received.</p>`,
      '<ul>',
      `<li>Preferred date: ${escapeHtml(message.preferredDate)}</li>`,
      `<li>Preferred time: ${escapeHtml(message.preferredTime)}</li>`,
      `<li>Selected hairstyle: ${styleHtml}</li>`,
      '</ul>',
      '<p>The salon will follow up if more details are needed.</p>',
    ].join('');

    await this.deliver({
      to: message.to,
      subject,
      text,
      html,
      debugLabel: 'customer salon booking',
      debug: { salonName: message.salonName, styleImageUrl: styleText },
    });
  }

  async sendSalonBookingCompletedEmail(message: SalonBookingEmail) {
    const subject = 'New salon booking request';
    const styleText = selectedHairstyleText(message.styleImageUrl);
    const styleHtml = selectedHairstyleHtml(message.styleImageUrl);
    const text = [
      `Hello${message.recipientName ? ` ${message.recipientName}` : ''},`,
      '',
      message.styleImageUrl
        ? 'A customer selected one of your uploaded hairstyles and submitted a booking request.'
        : 'A customer submitted a booking request without selecting a hairstyle.',
      `Customer: ${message.customerName}`,
      `Customer email: ${message.customerEmail}`,
      `Preferred date: ${message.preferredDate}`,
      `Preferred time: ${message.preferredTime}`,
      `Selected hairstyle: ${styleText}`,
    ].join('\n');

    const html = [
      `<p>Hello${message.recipientName ? ` ${escapeHtml(message.recipientName)}` : ''},</p>`,
      message.styleImageUrl
        ? '<p>A customer selected one of your uploaded hairstyles and submitted a booking request.</p>'
        : '<p>A customer submitted a booking request without selecting a hairstyle.</p>',
      '<ul>',
      `<li>Customer: ${escapeHtml(message.customerName)}</li>`,
      `<li>Customer email: ${escapeHtml(message.customerEmail)}</li>`,
      `<li>Preferred date: ${escapeHtml(message.preferredDate)}</li>`,
      `<li>Preferred time: ${escapeHtml(message.preferredTime)}</li>`,
      `<li>Selected hairstyle: ${styleHtml}</li>`,
      '</ul>',
    ].join('');

    await this.deliver({
      to: message.to,
      subject,
      text,
      html,
      debugLabel: 'salon booking',
      debug: {
        customerEmail: message.customerEmail,
        salonName: message.salonName,
        styleImageUrl: styleText,
      },
    });
  }

  private async deliver(mail: {
    to: string;
    subject: string;
    text: string;
    html: string;
    debugLabel: string;
    debug: Record<string, string>;
  }) {
    if (!this.webhookUrl) {
      if (this.smtpHost && this.smtpUser && this.smtpPass) {
        await sendSmtpMail({
          host: this.smtpHost,
          port: this.smtpPort,
          secure: this.smtpSecure,
          user: this.smtpUser,
          pass: this.smtpPass,
          from: this.from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        return;
      }

      console.log(`[${mail.debugLabel}]`, {
        to: mail.to,
        subject: mail.subject,
        ...mail.debug,
      });
      return;
    }

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
  }
}

type SmtpMail = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendSmtpMail(mail: SmtpMail) {
  if (!mail.secure) {
    throw new Error('Only secure SMTP over TLS is supported');
  }

  const socket = await connectSmtp(mail.host, mail.port);
  const session = new SmtpSession(socket);

  try {
    await session.expect(220);
    await session.command(`EHLO ${mail.host}`, 250);
    await session.command(
      `AUTH PLAIN ${Buffer.from(`\0${mail.user}\0${mail.pass}`).toString('base64')}`,
      235,
    );
    await session.command(`MAIL FROM:<${emailAddress(mail.from)}>`, 250);
    await session.command(`RCPT TO:<${mail.to}>`, [250, 251]);
    await session.command('DATA', 354);
    await session.writeData(buildRfc822Message(mail));
    await session.expect(250);
    await session.command('QUIT', 221);
  } finally {
    socket.end();
  }
}

function connectSmtp(host: string, port: number): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host, port, servername: host }, () => resolve(socket));
    socket.once('error', reject);
  });
}

class SmtpSession {
  private buffer = '';
  private pending:
    | {
        resolve: (line: string) => void;
        reject: (error: Error) => void;
      }
    | null = null;

  constructor(private readonly socket: TLSSocket) {
    socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf-8');
      this.flush();
    });
    socket.on('error', (error) => {
      this.pending?.reject(error);
      this.pending = null;
    });
  }

  async command(command: string, expected: number | number[]) {
    this.socket.write(`${command}\r\n`);
    await this.expect(expected);
  }

  async writeData(data: string) {
    this.socket.write(`${dotStuff(data)}\r\n.\r\n`);
  }

  expect(expected: number | number[]) {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];

    return this.readResponse().then((response) => {
      const code = Number(response.slice(0, 3));
      if (!expectedCodes.includes(code)) {
        throw new Error(`SMTP expected ${expectedCodes.join('/')} but received: ${response}`);
      }
    });
  }

  private readResponse(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.flush();
    });
  }

  private flush() {
    if (!this.pending) return;

    const lines = this.buffer.split(/\r\n/);
    if (lines.length < 2) return;

    let consumed = 0;
    const responseLines: string[] = [];
    for (const line of lines) {
      if (!line) break;

      consumed += line.length + 2;
      responseLines.push(line);

      if (/^\d{3} /.test(line)) {
        const pending = this.pending;
        this.pending = null;
        this.buffer = this.buffer.slice(consumed);
        pending.resolve(responseLines.join('\n'));
        return;
      }
    }
  }
}

function buildRfc822Message(mail: SmtpMail) {
  const boundary = `ai-hairstyle-${Date.now()}`;
  const headers = [
    `From: ${mail.from}`,
    `To: ${mail.to}`,
    `Subject: ${encodedHeader(mail.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mail.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    mail.html,
    `--${boundary}--`,
  ].join('\r\n');
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function emailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return match?.[1] ?? value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function selectedHairstyleText(styleImageUrl: string | null) {
  return styleImageUrl ?? 'Not selected';
}

function selectedHairstyleHtml(styleImageUrl: string | null) {
  if (!styleImageUrl) {
    return 'Not selected';
  }

  return `<a href="${escapeHtml(styleImageUrl)}">view image</a>`;
}
