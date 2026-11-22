import { createTransport, type Transporter } from 'nodemailer'
import type { Mailer } from '../../domain/mail.ts'

const TIMEOUT_MS = 5000

// Delivers only. Enquiry content is built by the service and failures are wrapped there.
export function createSmtpMailer(
  settings: { host: string; port: number; from: string },
  // Injectable so tests can build the message without opening a connection.
  transport: Transporter = createTransport({
    host: settings.host,
    port: settings.port,
    secure: false,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  }),
): Mailer {
  return {
    async send({ to, subject, body, replyTo }) {
      await transport.sendMail({ from: settings.from, to, replyTo, subject, text: body })
    },
  }
}
