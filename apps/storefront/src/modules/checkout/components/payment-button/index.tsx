"use client"

import { isBold, isManual, isStripeLike } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isBold(paymentSession?.provider_id):
      return (
        <BoldPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const { countryCode } = useParams()

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    if (!stripe || !elements || !cart) {
      return
    }

    setSubmitting(true)

    await stripe
      .confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/api/payment-return?cart_id=${cart.id}&country_code=${countryCode}`,
          payment_method_data: {
            billing_details: {
              name:
                cart.billing_address?.first_name +
                " " +
                cart.billing_address?.last_name,
              address: {
                city: cart.billing_address?.city ?? undefined,
                country: cart.billing_address?.country_code ?? undefined,
                line1: cart.billing_address?.address_1 ?? undefined,
                line2: cart.billing_address?.address_2 ?? undefined,
                postal_code: cart.billing_address?.postal_code ?? undefined,
                state: cart.billing_address?.province ?? undefined,
              },
              email: cart.email,
              phone: cart.billing_address?.phone ?? undefined,
            },
          },
        },
        // Only leave the site when the selected method actually requires it, so
        // card payments still complete inline.
        redirect: "if_required",
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
            return
          }

          setErrorMessage(error.message || null)
          setSubmitting(false)
          return
        }

        if (
          paymentIntent.status === "requires_capture" ||
          paymentIntent.status === "succeeded"
        ) {
          onPaymentCompleted()
          return
        }

        setSubmitting(false)
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

const BoldPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { countryCode } = useParams()

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]
  const sessionData = (paymentSession?.data || {}) as Record<string, any>

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!document.getElementById("bold-checkout-script")) {
      const script = document.createElement("script")
      script.id = "bold-checkout-script"
      script.src = "https://checkout.bold.co/library/boldPaymentButton.js"
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const handlePayment = () => {
    if (!sessionData.order_id || !sessionData.integrity_signature) {
      setErrorMessage("Faltan datos de la sesión de pago de Bold.")
      return
    }

    setSubmitting(true)

    const redirectionUrl = `${window.location.origin}/api/payment-return?cart_id=${cart.id}&country_code=${countryCode}&provider=bold`

    if (typeof (window as any).BoldCheckout !== "undefined") {
      try {
        const checkout = new (window as any).BoldCheckout({
          orderId: sessionData.order_id,
          currency: sessionData.currency || "COP",
          amount: sessionData.amount,
          apiKey: sessionData.api_key,
          integritySignature: sessionData.integrity_signature,
          redirectionUrl,
        })
        checkout.open()
      } catch (err: any) {
        setErrorMessage(err.message || "Error al abrir la pasarela de Bold.")
        setSubmitting(false)
      }
    } else {
      setErrorMessage(
        "Cargando pasarela de Bold... por favor intenta en unos segundos."
      )
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        className="bg-[#0025FF] hover:bg-[#001ecc] text-white"
        data-testid={dataTestId}
      >
        Pagar con Bold (PSE, Tarjetas, Nequi)
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="bold-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
