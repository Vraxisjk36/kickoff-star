import { useEffect, useState } from 'react'
import { listSaves } from '../engine/save'

interface MainMenuProps {
  onNewCareer: () => void
  onContinue: () => void
  onLoadCareer: () => void
  onOpenSettings: () => void
  onOpenCredits: () => void
  onOpenHelp: () => void
}

type Action = 'new' | 'continue' | 'load' | 'settings' | 'help' | 'credits'

const MENU_ITEMS = (hasSave: boolean) => [
  { icon: '★', label: 'New Career', sub: 'Start your journey', action: 'new' as Action },
  { icon: '↻', label: 'Continue', sub: 'Continue your saved career', action: 'continue' as Action, disabled: !hasSave },
  { icon: '⛁', label: 'Load Career', sub: 'Load a previously saved career', action: 'load' as Action, disabled: !hasSave },
  { icon: '?', label: 'Help', sub: 'How Kickoff Star works', action: 'help' as Action },
  { icon: '⚙', label: 'Settings', sub: 'Game settings and preferences', action: 'settings' as Action },
  { icon: '◈', label: 'Credits', sub: 'Meet the team', action: 'credits' as Action },
]

export default function MainMenu({ onNewCareer, onContinue, onLoadCareer, onOpenSettings, onOpenCredits, onOpenHelp }: MainMenuProps) {
  const [hasSave, setHasSave] = useState(false)

  useEffect(() => {
    listSaves().then((saves) => setHasSave(saves.some(Boolean)))
  }, [])

  const handleClick = (action: Action) => {
    if (action === 'new') onNewCareer()
    else if (action === 'continue') onContinue()
    else if (action === 'load') onLoadCareer()
    else if (action === 'settings') onOpenSettings()
    else if (action === 'credits') onOpenCredits()
    else if (action === 'help') onOpenHelp()
  }

  return (
    <div className="relative min-h-screen w-full bg-ks-black overflow-hidden">
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 40% 60% at 70% 20%, rgba(212,175,55,0.12), transparent 60%), radial-gradient(ellipse 50% 40% at 75% 90%, rgba(120,140,180,0.08), transparent 55%), linear-gradient(105deg, #050504 0%, #0a0a09 40%, #0d0d0b 70%, #050504 100%)`,
      }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(100deg, transparent 0 60px, rgba(255,255,255,0.5) 60px 61px)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 35%, rgba(0,0,0,0.25) 65%, transparent 100%)' }} />
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 60px rgba(0,0,0,0.8)' }} />

      <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 md:px-16 py-8 max-w-2xl">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-ks-muted uppercase mb-5">the journey starts here</div>
          <div style={{ filter: 'drop-shadow(0 0 30px rgba(212,175,55,0.3))' }} className="mb-5">
            <div className="font-display font-black text-5xl md:text-6xl tracking-wide leading-none text-ks-gold">KICKOFF</div>
            <div className="font-display font-black text-5xl md:text-6xl tracking-wide leading-none text-ks-ink">STAR</div>
          </div>
          <div className="text-[11px] text-ks-muted uppercase tracking-[0.15em]">from school football to a pro contract</div>
        </div>

        <div className="flex flex-col gap-2 my-6 max-w-md">
          {MENU_ITEMS(hasSave).map((item) => {
            const primary = item.action === 'new'
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleClick(item.action)}
                disabled={item.disabled}
                className={`group min-h-14 text-left rounded-xl px-5 py-3 flex items-center gap-4 transition-all active:scale-[0.99] disabled:opacity-25 ${primary ? 'bg-ks-gold text-ks-black shadow-[0_0_30px_rgba(212,175,55,0.25)]' : 'text-ks-ink border border-transparent hover:border-ks-border hover:bg-white/[0.03]'}`}
              >
                <span className={`text-lg w-5 ${primary ? '' : 'text-ks-muted group-hover:text-ks-gold'}`}>{item.icon}</span>
                <span className="flex flex-col">
                  <span className="font-display tracking-wide text-base leading-tight">{item.label}</span>
                  <span className={`text-[11px] ${primary ? 'opacity-70' : 'text-ks-muted'}`}>{item.sub}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div>
          <div className="max-w-xs mb-6 text-ks-ink italic">“Every legend started somewhere.”</div>
          <div className="flex items-center justify-between pt-4 border-t border-ks-border/40 max-w-md">
            <span className="text-ks-muted text-[10px] tracking-wider">PHASE 1 COMPLETE</span>
            <span className="text-ks-muted text-[10px] tracking-wider">V4.0 UNIFIED</span>
          </div>
        </div>
      </div>
    </div>
  )
}
