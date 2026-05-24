/**
 * Merchant logo display for the checkout page.
 *
 * Renders a skeleton while branding loads, the merchant's logo once
 * resolved, or a plain "Cyclo Checkout" wordmark when no logo is available
 * or the image fails to load. Uses co- CSS classes from SubscribePage.css.
 */
import { useState } from 'react'

interface CheckoutLogoAreaProps {
    loading:      boolean
    brandLogoUrl: string | null
}

export function CheckoutLogoArea({ loading, brandLogoUrl }: CheckoutLogoAreaProps) {
    const [imgError, setImgError] = useState(false)

    if (loading) {
        return <div className="co-logo-skel" aria-hidden="true" />
    }

    if (brandLogoUrl && !imgError) {
        return (
            <img
                className="co-logo-img"
                src={brandLogoUrl}
                alt="Merchant logo"
                onError={() => setImgError(true)}
            />
        )
    }

    return <span className="co-wordmark-fallback">Cyclo Checkout</span>
}
