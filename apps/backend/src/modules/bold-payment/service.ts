import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import crypto from "crypto"
import { BoldPaymentOptions, BoldPaymentSessionData } from "./types"

type PaymentSessionStatus =
  | "authorized"
  | "captured"
  | "pending"
  | "requires_more"
  | "error"
  | "canceled"

export class BoldPaymentProviderService extends AbstractPaymentProvider<BoldPaymentOptions> {
  static identifier = "bold"

  protected options_: BoldPaymentOptions

  constructor(container: any, options: BoldPaymentOptions) {
    super(container, options)
    this.options_ = options
  }

  /**
   * Genera el hash de integridad SHA256 requerido por el Botón de Pagos de Bold:
   * SHA256(orderId + amount + currency + secretKey)
   */
  private generateIntegritySignature(
    orderId: string,
    amount: number,
    currency: string
  ): string {
    const raw = `${orderId}${amount}${currency}${this.options_.secretKey}`
    return crypto.createHash("sha256").update(raw).digest("hex")
  }

  /**
   * Valida la firma del webhook con HMAC-SHA256 y la llave secreta:
   * Encabezado X-Bold-Signature
   */
  private verifyWebhookSignature(
    payloadRaw: string,
    signature: string
  ): boolean {
    if (!signature || !this.options_.secretKey) {
      return false
    }
    try {
      const computedSignature = crypto
        .createHmac("sha256", this.options_.secretKey)
        .update(payloadRaw)
        .digest("hex")
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
      )
    } catch {
      return false
    }
  }

  async initiatePayment(input: any): Promise<any> {
    const orderId = `bold_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`
    const amount = Number(input.amount)
    const currency = (input.currency_code || "cop").toUpperCase()
    const signature = this.generateIntegritySignature(orderId, amount, currency)

    const sessionData: BoldPaymentSessionData = {
      order_id: orderId,
      amount,
      currency,
      integrity_signature: signature,
      api_key: this.options_.apiKey,
      status: "pending",
    }

    return {
      id: orderId,
      data: sessionData,
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<any> {
    const isApproved =
      paymentSessionData.status === "authorized" ||
      paymentSessionData.status === "captured"

    return {
      status: isApproved ? "authorized" : "pending",
      data: {
        ...paymentSessionData,
        status: isApproved ? "authorized" : "pending",
      },
    }
  }

  async capturePayment(input: any): Promise<any> {
    const data = input.paymentSessionData || {}
    return {
      data: {
        ...data,
        status: "captured",
      },
    }
  }

  async refundPayment(input: any): Promise<any> {
    const data = input.paymentSessionData || {}
    return {
      data: {
        ...data,
        status: "refunded",
      },
    }
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    return {
      data: {
        ...paymentSessionData,
        status: "canceled",
      },
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    return {
      data: {
        ...paymentSessionData,
        status: "canceled",
      },
    }
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    const status = paymentSessionData.status as string
    switch (status) {
      case "captured":
        return "captured"
      case "authorized":
        return "authorized"
      case "canceled":
      case "failed":
        return "canceled"
      default:
        return "pending"
    }
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    return {
      data: paymentSessionData,
    }
  }

  async updatePayment(input: any): Promise<any> {
    const prevData = (input.data || {}) as BoldPaymentSessionData
    const amount = Number(input.amount)
    const currency = (
      input.currency_code ||
      prevData.currency ||
      "cop"
    ).toUpperCase()
    const orderId = prevData.order_id || `bold_${Date.now()}`
    const signature = this.generateIntegritySignature(orderId, amount, currency)

    return {
      data: {
        ...prevData,
        amount,
        currency,
        integrity_signature: signature,
      },
    }
  }

  async getWebhookActionAndData(payload: any): Promise<any> {
    const { data, rawData, headers } = payload
    const signature =
      headers?.["x-bold-signature"] || headers?.["X-Bold-Signature"]

    if (signature && rawData) {
      const isValid = this.verifyWebhookSignature(
        rawData.toString(),
        signature
      )
      if (!isValid) {
        return {
          action: "failed",
          data: { session_id: data?.order_id || data?.reference },
        }
      }
    }

    const status = (
      data?.status ||
      data?.payment_status ||
      ""
    ).toUpperCase()

    if (["PAID", "APPROVED", "SUCCESSFUL"].includes(status)) {
      return {
        action: "captured",
        data: {
          session_id: data.order_id || data.reference,
          amount: data.amount,
        },
      }
    }

    if (["REJECTED", "FAILED", "DECLINED"].includes(status)) {
      return {
        action: "failed",
        data: {
          session_id: data.order_id || data.reference,
        },
      }
    }

    return { action: "not_supported" }
  }
}

export default BoldPaymentProviderService
