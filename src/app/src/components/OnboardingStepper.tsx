/**
 * Stateless stepper component for the onboarding wizard.
 *
 * Renders 4 steps vertically with three visual states:
 *   - completed (index < currentStep): indigo filled circle, ✓, clickable
 *   - active    (index === currentStep): indigo filled circle, step number, not clickable
 *   - future    (index > currentStep): gray outlined circle, step number, not clickable
 *
 * Connector lines between steps are indigo when the lower step has been reached,
 * gray otherwise.
 */

/**
 * Represents a single step in the onboarding wizard.
 */
export interface OnboardingStep {
    title:       string
    description: string
}

interface OnboardingStepperProps {
    steps:       OnboardingStep[]
    currentStep: number
    onStepClick: (index: number) => void
}

type StepState = 'completed' | 'active' | 'future'

interface StepCircleProps {
    index: number
    state: StepState
}

function StepCircle({ index, state }: StepCircleProps) {
    const base = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0'

    if (state === 'completed') {
        return (
            <div className={`${base} bg-indigo-600 text-white`}>✓</div>
        )
    }

    if (state === 'active') {
        return (
            <div className={`${base} bg-indigo-600 text-white`}>
                {index + 1}
            </div>
        )
    }

    return (
        <div className={`${base} border-2 border-gray-300 text-gray-400`}>
            {index + 1}
        </div>
    )
}

/**
 * Stateless stepper component for the onboarding wizard.
 * @param steps - Ordered list of steps to display.
 * @param currentStep - Zero-based index of the currently active step.
 * @param onStepClick - Called with the step index when a completed step is clicked.
 */
export function OnboardingStepper({ steps, currentStep, onStepClick }: OnboardingStepperProps) {
    return (
        <div className="w-full">
            {steps.map((step, index) => {
                const isCompleted = index < currentStep
                const isActive    = index === currentStep
                const isLast      = index === steps.length - 1
                const state: StepState = isCompleted ? 'completed' : isActive ? 'active' : 'future'

                return (
                    <div key={step.title} className="flex gap-4">

                        {/* Left column: circle + vertical connector */}
                        <div className="flex flex-col items-center">
                            {isCompleted ? (
                                <button
                                    onClick={() => onStepClick(index)}
                                    className="focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full"
                                    aria-label={`Go back to ${step.title}`}
                                >
                                    <StepCircle index={index} state={state} />
                                </button>
                            ) : (
                                <StepCircle index={index} state={state} />
                            )}

                            {/* Connector line — omitted after the last step */}
                            {!isLast && (
                                <div
                                    className={`w-0.5 my-1 flex-1 ${
                                        index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                                    }`}
                                    style={{ minHeight: '2rem' }}
                                />
                            )}
                        </div>

                        {/* Right column: step title + description */}
                        <div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-8'}`}>
                            <p className={`text-sm leading-none mt-1.5 ${
                                isActive    ? 'text-indigo-700 font-semibold' :
                                isCompleted ? 'text-gray-900'                 :
                                              'text-gray-400'
                            }`}>
                                {step.title}
                            </p>
                            <p className="text-sm text-gray-500 mt-1 leading-snug">
                                {step.description}
                            </p>
                        </div>

                    </div>
                )
            })}
        </div>
    )
}
