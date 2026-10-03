// Phase 10: the bottom nav became real (was six static divs with no routing).
// Phase 29: restyled for game feel. A 7th tab had pushed it onto two rows and
// it read as a settings menu rather than a game HUD — now six tabs on one row,
// with the active tab lifting on a gold pill, an animated indicator bar, and
// chunkier icons.

import { NAV_ITEMS, type HubTab } from './navItems'

export default function BottomNav({ active, onSelect, badges }: {
  active: HubTab
  onSelect: (tab: HubTab) => void
  badges?: Partial<Record<HubTab, number>>
}) {
  // 'scouts' and 'table' are routable destinations that live inside another
  // tab's screen — light up the tab that actually renders them.
  const activeTab: HubTab = active === 'scouts' ? 'player' : active === 'table' ? 'fixtures' : active

  return (
    <nav aria-label="Career navigation"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto w-full z-30"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      {/* fade so content scrolls out under the bar rather than hitting a hard edge */}
      <div className="h-4 bg-gradient-to-t from-[#0a0a09] to-transparent pointer-events-none" />
      <div className="border-t border-ks-border/80 bg-[#0c0c0a]/95 backdrop-blur-sm px-1.5 pt-1.5 pb-1.5">
        <div className="grid grid-cols-6 gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.tab === activeTab
            const badge = badges?.[item.tab] ?? 0
            return (
              <button
                key={item.tab}
                onClick={() => onSelect(item.tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 pt-1.5 pb-1 rounded-xl transition-all duration-200 active:scale-90 ${
                  isActive
                    ? 'text-ks-gold bg-gradient-to-b from-ks-gold/20 to-ks-gold/5 -translate-y-0.5 shadow-[0_-2px_14px_rgba(212,175,55,0.18)]'
                    : 'text-ks-muted/70 hover:text-ks-muted'
                }`}
              >
                <span
                  key={isActive ? 'on' : 'off'}
                  className={`text-base leading-none ${isActive ? 'animate-[tabpop_0.25s_ease-out] drop-shadow-[0_0_6px_rgba(212,175,55,0.5)]' : ''}`}
                >
                  {item.icon}
                </span>
                <span className={`text-[8px] tracking-wide ${isActive ? 'font-display' : ''}`}>{item.label}</span>

                {/* active indicator */}
                <span
                  className={`absolute -bottom-0.5 h-0.5 rounded-full bg-ks-gold transition-all duration-200 ${
                    isActive ? 'w-5 opacity-100' : 'w-0 opacity-0'
                  }`}
                />

                {badge > 0 && (
                  <span className="absolute top-0.5 right-1.5 min-w-3.5 h-3.5 px-1 rounded-full bg-red-500 text-white text-[7px] font-display flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
