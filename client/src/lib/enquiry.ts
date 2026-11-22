export interface EnquiryPayload {
  name: string
  email: string
  phone?: string
  message: string
  product?: { id: string | number; title: string; price?: number }
  // Honeypot: only present when a bot filled it. The server answers 201 without sending.
  website?: string
}

// Resolves when the enquiry was delivered, rejects when it was not.
export type SubmitEnquiry = (payload: EnquiryPayload) => Promise<void>

export type EnquiryFieldName = 'name' | 'email' | 'phone' | 'message' | 'product'

// Rejection the form can show: server text per field, or one message for the whole enquiry.
// Any other rejection is a plain failure and the form uses its generic copy.
export class EnquiryError extends Error {
  readonly fields?: Partial<Record<EnquiryFieldName, string>>

  constructor(init: { fields?: Partial<Record<EnquiryFieldName, string>>; message?: string }) {
    super(init.message)
    this.name = 'EnquiryError'
    this.fields = init.fields
  }
}
