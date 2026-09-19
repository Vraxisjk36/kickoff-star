export type YouthRouteChoice = 'school' | 'grassroots'

export default function RouteSelection({ onChoose }: { onChoose: (route: YouthRouteChoice) => void }) {
  const routes = [
    { id:'school' as const, eyebrow:'SCHOOL FOOTBALL', title:'Represent your school', body:'Three weeks of trials, then an 18-match local school league. Finish in the top three to reach the Regional Schools Cup and chase representative selection.', foot:'10 schools · 18 league matches · regional pathway' },
    { id:'grassroots' as const, eyebrow:'GRASSROOTS FOOTBALL', title:'Join a local club', body:'Three weeks of club trials, then a 22-match grassroots league with cup football, contracts, promotion and the October development pathway.', foot:'12 clubs · 22 league matches · club pathway' },
  ]
  return <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8">
    <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(212,175,55,.09), transparent 60%),linear-gradient(180deg,#0a0a09,#050504)'}}/>
    <div className="relative z-10 max-w-md mx-auto w-full flex flex-col flex-1 justify-center">
      <div className="font-display tracking-[.25em] text-[10px] text-ks-gold uppercase mb-2">your first decision</div>
      <h1 className="font-display text-ks-ink text-3xl tracking-wide mb-2">Choose your route</h1>
      <p className="text-ks-muted text-sm leading-relaxed mb-7">Both roads can take you to an academy. You choose one route now—there is no second club running beside it.</p>
      <div className="flex flex-col gap-4">
        {routes.map(r=><button key={r.id} onClick={()=>onChoose(r.id)} className="text-left rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 active:border-ks-gold">
          <div className="font-display tracking-widest text-[10px] text-ks-gold mb-2">{r.eyebrow}</div>
          <div className="font-display text-ks-ink text-xl tracking-wide mb-2">{r.title}</div>
          <p className="text-[13px] text-ks-muted leading-relaxed mb-4">{r.body}</p>
          <div className="border-t border-ks-border pt-3 text-[10px] tracking-wide text-ks-ink">{r.foot}</div>
        </button>)}
      </div>
    </div>
  </div>
}
