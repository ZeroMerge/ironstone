import { Resend } from 'resend';
import { config } from './config.js';

export function emailEnabled() {
  return Boolean(config.resendApiKey);
}

export async function sendPdfEmail({ to, projectName, pdf }) {
  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({
    from: config.resendFrom,
    to,
    subject: `Your Ironstone moodboard — ${projectName}`,
    text: `Attached is your exported moodboard "${projectName}". Built with Ironstone.`,
    attachments: [
      {
        filename: `${projectName.replace(/[^\w\- ]/g, '').trim() || 'moodboard'}.pdf`,
        content: pdf.toString('base64'),
      },
    ],
  });
  if (error) throw new Error(error.message ?? 'Email delivery failed');
}
