/**
 * Right panel context — lets dashboard pages inject content into the
 * Layout's third column without prop-drilling through the router tree.
 *
 * Usage in a page:
 *   const panel = useMemo(() => <MyPanel data={data} />, [data])
 *   useRightPanel(panel, [data])
 *
 * Pages MUST memoize the ReactNode passed to useRightPanel to prevent
 * re-render loops (Layout.setState → children re-render → effect re-fires).
 * Passing [] for deps sets the panel once on mount (fine for static content).
 */
import {
    createContext,
    useContext,
    useEffect,
    type ReactNode,
    type Dispatch,
    type SetStateAction,
} from 'react'

/** Setter function provided by Layout's useState — consumed by useRightPanel. */
export type SetPanelFn = Dispatch<SetStateAction<ReactNode>>

/**
 * Layout provides this context. Default is a no-op so the hook is safe to
 * call in tests or pages rendered outside a Layout tree.
 */
export const RightPanelCtx = createContext<SetPanelFn>(() => {})

/**
 * Injects content into the layout's right panel for the page's lifetime.
 * Content is cleared automatically when the page unmounts.
 *
 * @param content - The ReactNode to render in the right panel.
 * @param deps    - Re-run deps (default [] = mount only). Pass data deps
 *                  when content should update as data changes.
 */
export function useRightPanel(content: ReactNode, deps: readonly unknown[] = []): void {
    const set = useContext(RightPanelCtx)
    useEffect(() => {
        set(content)
        return () => set(null)
        // Caller controls deps; content is excluded from lint rule intentionally —
        // callers are expected to stabilise it with useMemo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
}
