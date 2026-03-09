import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private fromEmail = 'contato@crievo.tech';

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
  }

  async sendLoginToken(to: string, token: string, name: string) {
    await this.resend.emails.send({
      from: `Dear Bot <${this.fromEmail}>`,
      to,
      subject: 'Seu código de acesso - Dear Bot',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; border-radius: 16px; overflow: hidden; border: 1px solid #1a1a1a;">
          <div style="padding: 32px 32px 24px; text-align: center;">
            <h1 style="color: #22c55e; font-size: 24px; margin: 0 0 8px;">Dear Bot</h1>
            <p style="color: #888; font-size: 14px; margin: 0;">Plataforma de Chatbot</p>
          </div>
          <div style="padding: 0 32px 32px;">
            <p style="color: #e0e0e0; font-size: 15px; margin: 0 0 16px;">
              Olá <strong>${name}</strong>,
            </p>
            <p style="color: #aaa; font-size: 14px; margin: 0 0 24px;">
              Use o código abaixo para acessar sua conta:
            </p>
            <div style="background: #111; border: 1px solid #22c55e33; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #22c55e; font-family: monospace;">
                ${token}
              </span>
            </div>
            <p style="color: #666; font-size: 13px; margin: 0; text-align: center;">
              Este código expira em <strong style="color: #aaa;">15 minutos</strong>.
            </p>
          </div>
          <div style="padding: 16px 32px; background: #080808; border-top: 1px solid #1a1a1a; text-align: center;">
            <p style="color: #444; font-size: 12px; margin: 0;">
              Se você não solicitou este código, ignore este email.
            </p>
          </div>
        </div>
      `,
    });
  }
}
