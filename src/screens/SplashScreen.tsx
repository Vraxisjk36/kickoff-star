import { useEffect, useState } from 'react'
import LogoBadge from '../components/LogoBadge'
import { useTranslate } from '../i18n'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const t = useTranslate()

  useEffect(() => {
    const start = Date.now()
    const duration = 2200
    let raf: number
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / duration) * 100)
      setProgress(pct)
      if (pct < 100) {
        raf = requestAnimationFrame(tick)
      } else {
        setTimeout(onDone, 400)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* ambient glow */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.12), transparent 60%)' }}
      />

      <div className="relative w-[min(66vw,280px)] animate-[fadeInUp_1s_ease-out]"><LogoBadge /></div>

      <div className="relative mt-10 w-48 h-1 rounded-full bg-[#1a1a17] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-ks-gold/60 to-ks-gold rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="relative mt-3 text-[10px] tracking-[0.3em] text-ks-muted uppercase animate-pulse">
        {t('loading')}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
