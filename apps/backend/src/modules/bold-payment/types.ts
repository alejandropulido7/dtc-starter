export interface BoldPaymentOptions {
  apiKey: string // Llave de Identidad (Identity Key) de Bold
  secretKey: string // Llave Secreta (Secret Key) de Bold
  mode?: "sandbox" | "production"
  redirectionUrl?: string
}

export interface BoldPaymentSessionData {
  order_id: string
  amount: number
  currency: string
  integrity_signature: string
  api_key: string
  checkout_url?: string
  status: "pending" | "authorized" | "captured" | "canceled" | "failed"
  [key: string]: unknown
}
