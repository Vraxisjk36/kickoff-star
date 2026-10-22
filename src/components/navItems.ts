// Split out of BottomNav so the component file only exports a component
// (keeps react-refresh happy and lets non-component files import the tab type).

// P29: 7 tabs wrapped onto two rows on a phone and looked broken. Now six,
// which fits one row comfortably at phone width:
//  - scouts moved INTO the player page (it's your career interest, it belongs
//    with your profile)
//  - fixtures and table merged into one 'league' tab with a segmented toggle,
//    since "who do we play" and "where are we" are the same question
//  - the freed slot goes to the shop
// 'table' and 'scouts' are kept in the type as routable destinations so
// existing deep links (e.g. "table →" on the hub) still work.
export type HubTab = 'home' | 'player' | 'people' | 'club' | 'fixtures' | 'table' | 'scouts' | 'shop' | 'lifestyle'

export const NAV_ITEMS: { tab: HubTab; icon: string; label: string }[] = [
  { tab: 'home', icon: '⌂', label: 'home' },
  { tab: 'player', icon: '☺', label: 'player' },
  { tab: 'people', icon: '♥', label: 'people' },
  { tab: 'club', icon: '▣', label: 'club' },
  { tab: 'fixtures', icon: '▤', label: 'league' },
  { tab: 'shop', icon: '⬢', label: 'shop' },
  { tab: 'lifestyle', icon: '✦', label: 'lifestyle' },
]
