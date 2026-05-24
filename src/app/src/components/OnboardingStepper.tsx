/**
 * Stateless horizontal step indicator for the onboarding wizard.
 *
 * Renders N circles connected by 0.5px separator lines. States:
 *   - completed (index < currentStep): accent-filled, ✓, clickable
 *   - active    (index === currentStep): accent border, step number
 *   - future    (index > currentStep):  bg-border-bright border, step number
 *   - flashing  (flashingStep === index): accent-filled ✓ (connect animation)
 *
 * CSS: onb- classes from OnboardingPage.css (loaded by parent OnboardingPage).
 */
import { Fragment } from 'react'

/** One step entry for the onboarding wizard. */
export interface OnboardingStep {
    title:       string
    description: string
}

interface OnboardingStepperProps {
    steps:        OnboardingStep[]
    currentStep:  number
    onStepClick:  (index: number) => void
    /** Index of the step circle to render with the success-flash style. */
    flashingStep?: number | null
}

type StepState = 'completed' | 'active' | 'future' | 'flashing'

/**
 * Horizontal step-indicator row for the onboarding wizard.
 * @param steps       - Ordered list of steps to display.
 * @param currentStep - Zero-based index of the currently active step.
 * @param onStepClick - Callback invoked with the step index when a completed step is clicked.
 * @param flashingStep - Optional index of the step to render in the success-flash style.
 * @returns Flex row of circles connected by thin separator lines.
 */
export function OnboardingStepper({
    steps, currentStep, onStepClick, flashingStep,
}: OnboardingStepperProps) {
    return (
        <div className="onb-stepper">
            {steps.map((step, index) => {
                const isCompleted = index < currentStep
                const isFlashing  = flashingStep != null && index === flashingStep
                const state: StepState =
                    isFlashing           ? 'flashing'  :
                    isCompleted          ? 'completed' :
                    index === currentStep ? 'active'   : 'future'

                const label = state === 'completed' || state === 'flashing'
                    ? '✓' : String(index + 1)

                return (
                    <Fragment key={step.title}>
                        {index > 0 && <div className="onb-step-line" />}
                        {isCompleted && !isFlashing ? (
                            <button
                                className={`onb-step-circle onb-step-circle--${state}`}
                                onClick={() => onStepClick(index)}
                                aria-label={`Go back to ${step.title}`}
                            >
                                {label}
                            </button>
                        ) : (
                            <div
                                className={`onb-step-circle onb-step-circle--${state}`}
                                aria-label={step.title}
                            >
                                {label}
                            </div>
                        )}
                    </Fragment>
                )
            })}
        </div>
    )
}
