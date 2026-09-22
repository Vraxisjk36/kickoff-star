export type YouthRouteChoice = 'school' | 'grassroots'

const ROUTES = [
  { id: 'school' as const, label: 'SCHOOL FOOTBALL', title: 'Represent your school', body: 'Win a place through three weeks of trials, play the school season and chase regional representative football.' },
  { id: 'grassroots' as const, label: 'GRASSROOTS FOOTBALL', title: 'Join a local club', body: 'Trial for a community club, play the grassroots league and cup route, and build your name through club football.' },
]

export default function RouteSelection({ onChoose }: { onChoose: (route: YouthRouteChoice) => void }) {
  return <div className="relative min-h-screen w-full bg-ks-black px-5 py-8"><div className="relative z-10 max-w-md mx-auto min-h-[85vh] flex flex-col justify-center">
    <div className="font-display tracking-[.25em] text-[10px] text-ks-gold mb-2">YOUR FIRST CAREER DECISION</div>
    <h1 className="font-display text-ks-ink text-3xl tracking-wide mb-2">Choose your route</h1>
    <p className="text-ks-muted text-sm leading-relaxed mb-7">Pick one pathway. You will not play school football and grassroots club football at the same time.</p>
    <div className="flex flex-col gap-4">{ROUTES.map(route => <button key={route.id} onClick={() => onChoose(route.id)} className="text-left rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 active:border-ks-gold">
      <div className="font-display tracking-widest text-[10px] text-ks-gold mb-2">{route.label}</div><div className="font-display text-ks-ink text-xl tracking-wide mb-2">{route.title}</div><p className="text-[13px] text-ks-muted leading-relaxed">{route.body}</p>
    </button>)}</div>
  </div></div>
}
