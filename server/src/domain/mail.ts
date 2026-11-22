export interface MailMessage {
  to: string
  subject: string
  body: string
  // Lets sales reply to the customer; the From address stays the configured sender.
  replyTo?: string
}

export interface Mailer {
  send(message: MailMessage): Promise<void>
}
