import nodemailer from 'nodemailer';

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 邮件服务
 * 用于发送提醒邮件
 */
class EmailService {
    private transporter;

    constructor() {
        // 使用环境变量配置 SMTP
        // 如果没有配置，则使用 Ethereal (测试用)
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT) || 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
        } else {
            console.warn('⚠️ SMTP not configured, using console logger for emails.');
            this.transporter = null;
        }
    }

    /**
     * 发送提醒邮件
     */
    async sendReminderEmail(to: string, title: string, content: string) {
        const safeTitle = escapeHtml(title);
        const safeContent = escapeHtml(content);

        const mailOptions = {
            from: process.env.SMTP_FROM || '"Naotu Reminders" <reminders@naotu.com>',
            to,
            subject: `[提醒] ${title}`,
            text: content,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #6366f1;">任务提醒</h2>
                    <p>您好，您在思维导图中设置的提醒已到期：</p>
                    <div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #6366f1; margin: 20px 0;">
                        <strong>${safeTitle}</strong>
                        ${safeContent ? `<p style="margin-top: 10px; color: #666;">${safeContent}</p>` : ''}
                    </div>
                    <p style="font-size: 12px; color: #999; margin-top: 30px;">
                        这是一封自动发送的邮件，请勿直接回复。
                    </p>
                </div>
            `,
        };

        if (this.transporter) {
            try {
                await this.transporter.sendMail(mailOptions);
                return true;
            } catch (error) {
                console.error('Failed to send email:', error);
                return false;
            }
        } else {
            console.log('--- Virtual Email ---');
            console.log(`To: ${to}`);
            console.log(`Subject: ${mailOptions.subject}`);
            console.log(`Content: ${content}`);
            console.log('---------------------');
            return true;
        }
    }
}

export const emailService = new EmailService();
