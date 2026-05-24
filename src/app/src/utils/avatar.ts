/**
 * Derives deterministic avatar colours from a wallet address.
 *
 * Maps one of 5 Ivory & Indigo palette entries to a wallet address using
 * the first address byte as a stable index. Same address → same colour,
 * no server round-trip needed.
 *
 * Token equivalents (exact hex from tokens.css — update both if tokens change):
 *   accent:  bg #EEF2FF (--accent-light),  text #4F46E5 (--accent)
 *   violet:  bg #F5F3FF (--violet-light),  text #7C3AED (--violet)
 *   info:    bg #F0F9FF (--info-light),    text #0284C7 (--info)
 *   warning: bg #FFFBEB (--warning-light), text #D97706 (--warning)
 *   success: bg #ECFDF5 (--success-light), text #059669 (--success)
 *
 * @param addr - EVM address starting with "0x"
 */

const AVATAR_PALETTE = [
    { bg: '#EEF2FF', text: '#4F46E5' },  // accent  (--accent-light  / --accent)
    { bg: '#F5F3FF', text: '#7C3AED' },  // violet  (--violet-light  / --violet)
    { bg: '#F0F9FF', text: '#0284C7' },  // info    (--info-light    / --info)
    { bg: '#FFFBEB', text: '#D97706' },  // warning (--warning-light / --warning)
    { bg: '#ECFDF5', text: '#059669' },  // success (--success-light / --success)
] as const

/**
 * Maps a wallet address to one of 5 Ivory & Indigo palette entries.
 * Uses the first address byte (after "0x") to select the palette index.
 */
export function avatarPalette(addr: string): { bg: string; text: string } {
    const idx = parseInt(addr.slice(2, 4), 16) % AVATAR_PALETTE.length
    return AVATAR_PALETTE[idx]
}

/**
 * Alias for avatarPalette — same token-aligned palette.
 * Kept as a separate export so call-sites in OverviewPanel and
 * RecentSettlementsTable don't need updating.
 */
export function addressColor(addr: string): { bg: string; text: string } {
    return avatarPalette(addr)
}
