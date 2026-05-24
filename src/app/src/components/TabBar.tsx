/**
 * Horizontal tab navigation bar.
 * Tabs listed in disabledIds are rendered muted and non-clickable.
 */
interface Tab<T extends string> {
    id:    T;
    label: string;
}

interface TabBarProps<T extends string> {
    tabs:        Tab<T>[];
    active:      T;
    onChange:    (id: T) => void;
    disabledIds?: T[];
}

export function TabBar<T extends string>({ tabs, active, onChange, disabledIds = [] }: TabBarProps<T>) {
    return (
        <nav style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e4e7', marginBottom: '24px' }}>
            {tabs.map(tab => {
                const isDisabled = disabledIds.includes(tab.id);
                const isActive   = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        onClick={() => !isDisabled && onChange(tab.id)}
                        disabled={isDisabled}
                        style={{
                            padding:         '10px 20px',
                            border:          'none',
                            borderBottom:    isActive ? '2px solid #6366f1' : '2px solid transparent',
                            background:      'none',
                            cursor:          isDisabled ? 'not-allowed' : 'pointer',
                            fontWeight:      isActive ? 600 : 400,
                            color:           isDisabled ? '#d1d5db' : isActive ? '#6366f1' : '#6b6375',
                            fontSize:        '15px',
                            transition:      'color 0.15s',
                            opacity:         isDisabled ? 0.5 : 1,
                        }}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </nav>
    );
}
