import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"
import crypto from "crypto"
import { BoldPaymentOptions, BoldPaymentSessionData } from "./types"

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

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
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
      data: sessionData as unknown as Record<string, unknown>,
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = input.data || {}
    const isApproved =
      data.status === "authorized" || data.status === "captured"

    return {
      status: isApproved ? "authorized" : "pending",
      data: {
        ...data,
        status: isApproved ? "authorized" : "pending",
      },
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = input.data || {}
    return {
      data: {
        ...data,
        status: "captured",
      },
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = input.data || {}
    return {
      data: {
        ...data,
        status: "refunded",
      },
    }
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    const data = input.data || {}
    return {
      data: {
        ...data,
        status: "canceled",
      },
    }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    const data = input.data || {}
    return {
      data: {
        ...data,
        status: "canceled",
      },
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = input.data || {}
    const status = (data.status as string) || "pending"
    switch (status) {
      case "captured":
        return { status: "captured", data }
      case "authorized":
        return { status: "authorized", data }
      case "canceled":
      case "failed":
        return { status: "canceled", data }
      default:
        return { status: "pending", data }
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return {
      data: input.data || {},
    }
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    const prevData = (input.data || {}) as unknown as BoldPaymentSessionData
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

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, rawData, headers } = (payload || {}) as any
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
