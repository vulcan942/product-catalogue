import { createTransport } from 'nodemailer'
import { describe, expect, it } from 'vitest'
import { createSmtpMailer } from './smtpMailer.ts'

// jsonTransport builds the full message and returns it as JSON; nothing is sent.
async function deliver(message: Parameters<ReturnType<typeof createSmtpMailer>['send']>[0]) {
  const transport = createTransport({ jsonTransport: true })
  let sent: Record<string, unknown> = {}
  const original = transport.sendMail.bind(transport)
  transport.sendMail = (async (options: Parameters<typeof original>[0]) => {
    const info = await original(options)
    sent = JSON.parse(String(info.message))
    return info
  }) as typeof transport.sendMail
  await createSmtpMailer({ host: 'unused', port: 1, from: 'catalogue@example.com' }, transport).send(message)
  return sent
}

describe('SMTP mailer', () => {
  it('maps the message to from, to, reply-to, subject and text', async () => {
    const sent = await deliver({ to: 'sales@example.com', subject: 'Enquiry', body: 'Hello', replyTo: 'jo@example.com' })
    expect(sent).toMatchObject({
      from: { address: 'catalogue@example.com' },
      to: [{ address: 'sales@example.com' }],
      replyTo: [{ address: 'jo@example.com' }],
      subject: 'Enquiry',
      text: 'Hello',
    })
  })

  it('rejects when the transport fails', async () => {
    const failing = createTransport({ jsonTransport: true })
    failing.sendMail = (async () => {
      throw new Error('connection refused')
    }) as typeof failing.sendMail
    const mailer = createSmtpMailer({ host: 'unused', port: 1, from: 'catalogue@example.com' }, failing)
    await expect(mailer.send({ to: 'sales@example.com', subject: 's', body: 'b' })).rejects.toThrow('connection refused')
  })
})
