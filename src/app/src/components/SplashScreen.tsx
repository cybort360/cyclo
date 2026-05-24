/**
 * SplashScreen — branded loading overlay shown during initial hydration.
 *
 * Renders above everything (z-index 9999) while the app bootstraps.
 * When `visible` transitions to false the overlay fades out and scales up
 * slightly over 300 ms, then unmounts.
 *
 * Props:
 *   visible — controlled by App.tsx; set to false when ready to reveal the app.
 *
 * Class prefix: sp-  (CSS in SplashScreen.css)
 */
import { useState, useEffect } from 'react'
import { LogoIcon } from './Logo'
import './SplashScreen.css'

interface SplashScreenProps {
    visible: boolean
}

/** Duration (ms) of the exit animation — must match @keyframes sp-exit. */
const EXIT_DURATION_MS = 300

export function SplashScreen({ visible }: SplashScreenProps) {
    // `mounted`  — controls whether the element is in the DOM at all.
    // `exiting`  — adds the sp-root--exit class to trigger the CSS animation.
    const [mounted, setMounted] = useState(true)
    const [exiting, setExiting] = useState(false)

    useEffect(() => {
        // Ignore the initial render and any case where visible is still true.
        if (visible || exiting) return

        setExiting(true)
        const timer = setTimeout(() => setMounted(false), EXIT_DURATION_MS)
        return () => clearTimeout(timer)
    }, [visible, exiting])

    if (!mounted) return null

    return (
        <div className={`sp-root${exiting ? ' sp-root--exit' : ''}`} aria-hidden="true">
            <div className="sp-center">
                <LogoIcon size={64} />
                <p className="sp-wordmark">CYCLO</p>
                <div className="sp-bar-track">
                    <div className="sp-bar-fill" />
                </div>
            </div>
        </div>
    )
}
