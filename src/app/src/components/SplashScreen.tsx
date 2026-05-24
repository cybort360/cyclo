/**
 * SplashScreen — branded loading overlay shown during initial hydration.
 *
 * Renders above everything (z-index 9999) while the app bootstraps.
 * When `visible` transitions to false the overlay fades out and scales up
 * slightly over 300 ms, then unmounts via onAnimationEnd.
 *
 * Why onAnimationEnd instead of setTimeout:
 *   The effect depends only on [visible]. When setExiting(true) is called,
 *   exiting is NOT in the deps array, so React does not re-run the effect
 *   and does not call clearTimeout — the timer stays alive.
 *   Using onAnimationEnd removes the timer entirely and lets the CSS itself
 *   signal when the exit is complete, which is simpler and race-free.
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

export function SplashScreen({ visible }: SplashScreenProps) {
    // `mounted`  — controls whether the element is in the DOM at all.
    // `exiting`  — adds the sp-root--exit class to trigger the CSS animation.
    const [mounted, setMounted] = useState(true)
    const [exiting, setExiting] = useState(false)

    // Only depend on [visible]. When exiting changes the effect must NOT re-run —
    // re-running would cancel the in-flight timer via cleanup.
    useEffect(() => {
        if (visible) return
        setExiting(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible])

    // Remove from DOM when the CSS exit animation fires its end event.
    // Guard on animationName so the bar-fill animation (from a child element)
    // does not trigger an early unmount.
    function handleAnimationEnd(e: React.AnimationEvent<HTMLDivElement>): void {
        if (e.animationName === 'sp-exit') setMounted(false)
    }

    if (!mounted) return null

    return (
        <div
            className={`sp-root${exiting ? ' sp-root--exit' : ''}`}
            onAnimationEnd={handleAnimationEnd}
            aria-hidden="true"
        >
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
