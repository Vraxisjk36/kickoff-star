import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { availableProLoans, availableProTransfers, type ProAction } from '../engine/proCareer'
import { createProContract, PRO_AGENTS } from '../engine/proContracts'
import { useTranslate } from '../i18n'
import BottomNav from '../components/BottomNav'
import Avatar from '../components/Avatar'
import { NAV_ITEMS, type HubTab } from '../components/navItems'
import ProWorldPanel from './ProWorldPanel'
import ProAssetsPanel from './ProAssetsPanel'
import { getNation } from '../engine/nations'
import { nationalCallupFixture } from '../engine/proTournaments'
import { PRO_SPONSORS, signatureBootEligible } from '../engine/proMedia'

const ACTIONS: { id: ProAction; title: string; detail: string }[] = [
  { id: 'train', title: 'Train', detail: 'Build coach trust · costs energy' },
  { id: 'recover', title: 'Recover', detail: 'Restore 23 energy for the next match' },
  { id: 'media', title: 'Press', detail: 'Answer the local press · build reputation' },
  { id: 'rest', title: 'Rest', detail: 'Take a lighter day · restore energy' },
]
export default function ProCareerScreen({ onMenu }: { onMenu: () => void }) {
  const t = useTranslate()
  const career = useCareerStore(state => state.proCareer)
  const world = useCareerStore(state => state.proWorld)
  const player = useCareerStore(state => state.player)
  const advance = useCareerStore(state => state.advanceProCareerDay)
  const sign = useCareerStore(state => state.signProClub)
  const resolveEvent = useCareerStore(state => state.resolveProCareerEvent)
  const chooseAgent = useCareerStore(state => state.chooseProRepresentation)
  const beginTalks = useCareerStore(state => state.beginProNegotiation)
  const counter = useCareerStore(state => state.counterProNegotiation)
  const decline = useCareerStore(state => state.declineProNegotiation)
  const acceptLoan = useCareerStore(state => state.acceptProLoan)
  const retire = useCareerStore(state => state.finishProCareer)
  const respondSponsor = useCareerStore(state => state.respondProSponsor)
  const createBoot = useCareerStore(state => state.createSignatureBoot)
  const [tab, setTab] = useState<HubTab>('home')
  const [mediaScope, setMediaScope] = useState<'all' | 'club' | 'country' | 'world'>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = (operation: () => void) => { setBusy(true); setError(''); try { operation() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Action unavailable') } finally { setBusy(false) } }
  if (!career || !world || !player) return null
  const club = career.clubId ? world.clubs[career.clubId] : null
  const fixtures = club ? Object.values(world.fixtures).filter(fixture => !fixture.result &&
    (fixture.homeId === club.id || fixture.awayId === club.id)).sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate)).slice(0, 3) : []
  const currency = club ? world.associations[club.associationId].currency : ''
  const transfers = career.stage === 'signed' && !career.talks ? availableProTransfers(world, career) : []
  const loans = career.stage === 'signed' && !career.talks ? availableProLoans(world, career) : []
  const clubPlaysToday = club && Object.values(world.fixtures).some(fixture => fixture.kickoffDate === career.date &&
    (fixture.homeId === club.id || fixture.awayId === club.id))
  const nationalFixture = career.stage === 'signed' && career.playerId && !clubPlaysToday
    ? nationalCallupFixture(world, career.playerId, getNation(player.nationality).id, career.date) : null
  const signed = career.stage === 'signed'
  const sectionTitle: Record<string, string> = { player: 'THE MAKING OF A PLAYER', people: 'EVERY BOND COUNTS.', club: 'ONE BADGE. ONE SEASON.', fixtures: 'THE ROAD AHEAD.', shop: 'BUILD YOUR FUTURE.' }
  return <main className="hub-shell min-h-screen bg-ks-black text-ks-ink pb-32">
    <div className="sticky top-0 z-20 bg-ks-black/95 backdrop-blur border-b border-ks-border/50">
      <div className="max-w-md mx-auto w-full px-3 py-2 flex items-center justify-between gap-3">
        <span className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{t(NAV_ITEMS.find(item => item.tab === tab)?.label ?? 'home')} · {t('Professional career')}</span>
        <button type="button" className="career-menu-button" onClick={onMenu}>☰ <span>{t('MENU')}</span></button>
      </div>
      <div className="max-w-md mx-auto px-3 pb-2 flex items-center gap-2"><span className="text-[10px] font-display text-ks-muted">{t('ENERGY')}</span><span className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden"><span className="block h-full bg-ks-gold" style={{ width: `${career.energy}%` }} /></span><b className="text-xs">{career.energy}%</b></div>
    </div>
    <div className="hub-content max-w-md mx-auto px-3 pt-3 flex flex-col gap-2.5">
      {(!signed || tab === 'home') && <section className="career-hero">
        <div className="career-hero-glow" />
        <div className="career-hero-top"><span>KICKOFF STAR · {t('PRO CAREER')}</span><b>{career.date}</b></div>
        <div className="career-player">
          <Avatar id={player.avatarId ?? 0} size={62} className="career-avatar" />
          <div className="min-w-0"><small>{career.stage === 'trial' ? t('THREE-WEEK TRIAL') : career.stage === 'offers' ? t('CLUB OFFERS') : club?.name ?? t('PRO CAREER')}</small><h1>{player.name}</h1><p>{career.stage === 'trial' ? `${t('Trial day')} ${career.trialDay + 1} / 21` : career.stage === 'offers' ? t('Choose your next club') : `${club?.homeCity ?? ''} · #${world.players[career.playerId ?? '']?.shirtNumber ?? '—'}`}</p></div>
          <div className="career-ovr"><strong>{world.players[career.playerId ?? '']?.overall ?? Math.round(40 + career.trialScore / 8)}</strong><span>OVR</span></div>
        </div>
        <div className="career-hero-strip"><div><span>{t('ENERGY')}</span><b>{career.energy}%</b></div><div><span>{t('COACH TRUST')}</span><b>{career.trust}%</b></div><div><span>{t('FORM')}</span><b>{career.days.filter(day => day.rating).at(-1)?.rating?.toFixed(1) ?? '—'}</b></div></div>
      </section>}
      {signed && tab !== 'home' && <section className="broadcast-head broadcast-head--gold" aria-label={`${tab} overview`}>
        <div className="broadcast-head__texture" aria-hidden="true" />
        <div className="broadcast-head__top"><span>KS / {t(tab.toUpperCase())}</span><span>{career.date}</span></div>
        <div className="broadcast-head__body"><div className="broadcast-head__identity"><span className="broadcast-head__index">PRO / {t('CAREER')}</span><h2>{sectionTitle[tab] ?? 'THE ROAD AHEAD.'}</h2><p>{tab === 'player' ? player.name : tab === 'club' ? club?.name : tab === 'shop' ? t('Every choice has a cost') : t('Your world keeps moving')}</p></div><div className="broadcast-head__emblem" aria-hidden="true">{tab === 'player' ? <Avatar id={player.avatarId ?? 0} size={82} /> : <span>{tab === 'club' ? '★' : tab === 'people' ? '✦' : tab === 'shop' ? '⬢' : '▤'}</span>}</div></div>
        <div className="broadcast-head__metrics"><div><b>{career.appearances}</b><span>{t('APPEARANCES')}</span></div><div><b>{career.goals}</b><span>{t('GOALS')}</span></div><div><b>{career.assists}</b><span>{t('ASSISTS')}</span></div></div>
      </section>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/50 p-3 text-sm text-red-200">{error}</p>}
      {career.stage === 'offers' ? <section className="mt-5 space-y-3">
        <div className="rounded-2xl border border-ks-gold/35 p-5"><h2 className="font-display text-xl text-ks-gold">{t('Choose representation')}</h2><div className="space-y-2 mt-3">{PRO_AGENTS.map(agent => <button key={agent.id} type="button" aria-pressed={career.agentId === agent.id} onClick={() => run(() => chooseAgent(agent.id))} className={`block w-full rounded-xl border p-3 text-left ${career.agentId === agent.id ? 'border-ks-gold' : 'border-ks-border'}`}><strong className="block">{t(agent.name)}</strong><span className="text-xs text-ks-muted">{t(agent.description)}</span></button>)}</div></div>
        {career.talks && <div className="rounded-2xl border border-ks-gold/50 p-5"><h2 className="font-display text-xl text-ks-gold">{t('Contract talks')} · {world.clubs[career.talks.clubId].name}</h2><p className="text-sm text-ks-muted mt-2">{career.talks.status === 'pending' ? `${t('Club response expected')} ${career.talks.ready}` : career.talks.status === 'rejected' ? t('The club declined your counteroffer.') : t('Terms are ready for a decision.')}</p><p className="mt-2">{world.associations[world.clubs[career.talks.clubId].associationId].currency} {(career.talks.annualWage / 100).toLocaleString()} / year</p>{career.talks.status === 'ready' && (() => { const offer = career.offers.find(item => item.clubId === career.talks!.clubId)!; const terms = createProContract(world, `career-${player.id}`, offer.clubId, career.date, career.talks!.annualWage, offer.role, career.agentId ?? 'family', offer.loanRisk); return <p className="text-xs text-ks-muted mt-2">{t('Appearance bonus')} {terms.appearanceBonus / 100} · {t('Goal bonus')} {terms.goalBonus / 100} · {t('Assist bonus')} {terms.assistBonus / 100} · {t('Release clause')} {terms.releaseClause ? terms.releaseClause / 100 : '—'}</p> })()}
          <div className="flex flex-wrap gap-2 mt-4">{career.talks.status === 'pending' && <button onClick={() => run(() => advance('rest'))} className="rounded-xl bg-ks-gold text-ks-black px-4 min-h-11">{t('Continue to next day')}</button>}{career.talks.status === 'ready' && <><button onClick={() => run(() => sign(career.talks!.clubId))} className="rounded-xl bg-ks-gold text-ks-black px-4 min-h-11">{t('Accept terms')}</button>{!career.talks.countered && <button onClick={() => run(counter)} className="rounded-xl border border-ks-gold px-4 min-h-11">{t('Counter')}</button>}</>}<button onClick={() => run(decline)} className="rounded-xl border border-ks-border px-4 min-h-11">{t('Walk away')}</button></div></div>}
        {career.offers.map(offer => { const team = world.clubs[offer.clubId]; const code = world.associations[team.associationId].currency
          return <article key={offer.clubId} className="rounded-2xl border border-ks-border p-5 bg-white/[.025]">
            <div className="text-xs text-ks-gold uppercase tracking-widest">{world.associations[team.associationId].name}</div>
            <h2 className="font-display text-2xl mt-1">{team.name}</h2>
            <p className="text-sm text-ks-muted mt-2">{offer.role} · {code} {(offer.annualWage / 100).toLocaleString()} / year · {offer.loanRisk} loan risk</p>
            <button type="button" onClick={() => run(() => beginTalks(offer.clubId))} disabled={busy || !career.agentId || !!career.talks}
              className="mt-4 w-full min-h-12 bg-ks-gold text-ks-black rounded-xl font-display disabled:opacity-40">{t('Open contract talks')} →</button>
          </article> })}
        {!career.offers.length && <p className="text-ks-muted">{t('No affordable offers are available. Return to the menu and try another route.')}</p>}
      </section> : career.stage === 'retired' ? <section className="mt-6 rounded-2xl border border-ks-gold/40 p-6"><h2 className="font-display text-2xl text-ks-gold">{t('A career to remember')}</h2><p className="mt-3 text-ks-ink">{career.appearances} {t('appearances')} · {career.goals} {t('goals')} · {career.assists} {t('assists')}</p><button className="mt-5 text-ks-gold" onClick={onMenu}>{t('Back to menu')} →</button></section> : <>
        {tab === 'home' && <div className="grid grid-cols-3 gap-2 mt-5">
          {[[t('Energy'), `${career.energy}%`], [t('Coach trust'), `${career.trust}%`], [t('Reputation'), `${career.reputation}`]].map(([label, value]) => <div key={label} className="rounded-xl border border-ks-border p-3 bg-white/[.025]"><div className="text-[10px] text-ks-muted uppercase">{label}</div><div className="font-display text-xl text-ks-gold mt-1">{value}</div></div>)}
        </div>}
        {tab === 'home' && club && <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs text-ks-muted"><span>{career.appearances} {t('matches')}</span><span>{career.goals} {t('goals')}</span><span>{currency} {(career.balance / 100).toLocaleString()} {t('earned')}</span></div>}
        {tab === 'home' && !!career.nationalCaps && <p className="text-center text-xs text-ks-gold mt-2">{career.nationalCaps} {t('international caps')} · {career.nationalGoals ?? 0} {t('international goals')}</p>}
        {tab === 'home' && nationalFixture && <div className="rounded-2xl border border-ks-gold/50 p-4 mt-5 bg-ks-gold/10"><strong>{t('National team call-up')} · {world.associations[getNation(player.nationality).id].name}</strong><p className="text-sm text-ks-muted mt-1">{t('Today')} · {world.associations[nationalFixture.homeId === getNation(player.nationality).id ? nationalFixture.awayId : nationalFixture.homeId].name}</p></div>}
        {(tab === 'player' || tab === 'club') && career.contract && <section className="rounded-2xl border border-ks-gold/35 p-5 mt-6"><h2 className="font-display text-xl text-ks-gold">{t('Your contract')}</h2><p className="text-sm mt-2">{career.contract.currency} {(career.contract.annualWage / 100).toLocaleString()} / {t('year')} · {career.contract.role} · {t('until')} {career.contract.expires}</p><p className="text-xs text-ks-muted mt-2">{t('Appearance')} {career.contract.appearanceBonus / 100} · {t('Goal')} {career.contract.goalBonus / 100} · {t('Assist')} {career.contract.assistBonus / 100} · {t('Release clause')} {career.contract.releaseClause ? (career.contract.releaseClause / 100).toLocaleString() : '—'}</p><p className="text-xs text-ks-muted mt-2">{t('Agent')} {PRO_AGENTS.find(agent => agent.id === career.agentId)?.name} · {career.residence?.city} · {t('Rent')} {currency} {((career.residence?.monthlyRent ?? 0) / 100).toLocaleString()} / {t('month')}</p></section>}
        {tab === 'player' && career.injuryUntil && career.injuryUntil >= career.date && <div className="rounded-2xl border border-red-500/40 bg-red-900/10 p-4 mt-4"><strong>{t('Injured')}</strong><p className="text-sm text-ks-muted mt-1">{t('Expected return')} {career.injuryUntil}. {t('Training and matches are restricted during recovery.')}</p></div>}
        {tab === 'player' && career.playerId && world.players[career.playerId]?.injuryHistory?.length ? <section className="mt-5"><h2 className="font-display text-ks-gold">{t('Medical record')}</h2>{world.players[career.playerId].injuryHistory!.slice(-4).reverse().map(injury => <p key={injury.id} className="border-b border-ks-border py-2 text-xs text-ks-muted">{injury.date} · {injury.kind} · {injury.severity} · {injury.daysOut} {t('days')}</p>)}</section> : null}
        {tab === 'player' && career.ledger?.length ? <section className="mt-6"><h2 className="font-display text-ks-gold">{t('Monthly statements')}</h2>{career.ledger.slice(-3).reverse().map(line => <div key={line.id} className="border-b border-ks-border py-3 text-xs"><strong>{line.date} · {line.currency} {(line.net / 100).toLocaleString()}</strong><p className="text-ks-muted mt-1">{t('Gross')} {line.gross / 100} + {t('Bonus')} {line.bonus / 100} − {t('Estimated withholding')} {line.estimatedWithholding / 100} − {t('Agent')} {line.agentFee / 100} − {t('Housing')} {line.housing / 100}</p></div>)}<p className="text-[10px] text-ks-muted mt-2">{t('Fictional game estimates; country tax rates and eligibility are not represented as law.')}</p></section> : null}
        {tab === 'people' && career.stage === 'signed' && <section className="mt-7 rounded-2xl border border-ks-gold/30 p-5 bg-white/[.025]">
          <div className="text-xs uppercase tracking-widest text-ks-gold">{t('Commercial life')}</div>
          <div className="flex gap-4 mt-3 text-sm"><span>{(career.followers ?? 0).toLocaleString()} {t('followers')}</span><span>{career.sponsorDeals?.filter(deal => deal.status === 'active').length ?? 0} {t('active deals')}</span></div>
          {career.sponsorOffers?.filter(offer => offer.status === 'offered' && offer.expires >= career.date).map(offer => { const sponsor = PRO_SPONSORS.find(item => item.id === offer.sponsorId)!; return <article key={offer.id} className="rounded-xl border border-ks-gold/40 p-4 mt-4"><strong className="text-ks-gold">{sponsor.name}</strong><p className="text-xs text-ks-muted mt-1">{sponsor.history}</p><p className="text-xs mt-2">{offer.years} {t('years')} · {currency} {(offer.annualFee / 100).toLocaleString()} / {t('year')} · {offer.appearanceTarget} {t('appearances required')}</p><p className="text-xs text-ks-muted mt-1">{t('Featured athletes')}: {sponsor.topPlayers.map(person => `${person.name} (${person.overall})`).join(', ')}</p><p className="text-xs text-ks-muted">{t('Partner clubs')}: {sponsor.topClubs.join(', ')}</p><div className="flex gap-3 mt-3"><button className="min-h-11 px-3 rounded-lg bg-ks-gold text-ks-black" onClick={() => run(() => respondSponsor(offer.id, true))}>{t('Sign deal')}</button><button className="min-h-11 px-3 rounded-lg border border-ks-border" onClick={() => run(() => respondSponsor(offer.id, false))}>{t('Decline')}</button></div></article> })}
          {career.sponsorDeals?.filter(deal => deal.status === 'active').map(deal => <p key={deal.id} className="text-xs mt-2">{PRO_SPONSORS.find(item => item.id === deal.sponsorId)?.name} · {t('until')} {deal.expires}</p>)}
          {signatureBootEligible(career) && !career.signatureBoot && <button className="mt-4 min-h-11 rounded-lg border border-ks-gold px-3" onClick={() => { const name = window.prompt(t('Name your signature boot')); if (name) run(() => createBoot(name)) }}>{t('Launch signature boots')} →</button>}
          {career.signatureBoot && <p className="text-ks-gold mt-3 text-sm">{t('Signature boot')}: {career.signatureBoot.name}</p>}
        </section>}
        {tab === 'shop' && career.stage === 'signed' && <ProAssetsPanel />}
        {tab === 'people' && career.mediaLog?.length ? <section className="mt-7"><h2 className="font-display text-xl text-ks-gold">{t('Gazette & social')}</h2><div className="flex gap-2 overflow-x-auto mt-3">{(['all','club','country','world'] as const).map(scope => <button type="button" key={scope} aria-pressed={mediaScope === scope} onClick={() => setMediaScope(scope)} className={`border rounded-full px-3 py-1 text-xs ${mediaScope === scope ? 'border-ks-gold text-ks-gold' : 'border-ks-border'}`}>{t(scope)}</button>)}</div>{career.mediaLog.filter(item => mediaScope === 'all' || item.scope === mediaScope).slice(-8).reverse().map(item => <article key={item.id} className="border-b border-ks-border py-3"><div className="uppercase tracking-widest text-[10px] text-ks-gold">{item.channel} · {item.scope} · {item.date}</div><strong className="text-sm">{t(item.headline)}</strong><p className="text-xs text-ks-muted mt-1">{t(item.body)}</p></article>)}</section> : null}
        {tab === 'club' && career.loan && <p className="mt-5 text-sm text-ks-gold">{t('Loan spell')} · {t('Return scheduled')} {career.loan.ends}</p>}
        {tab === 'club' && career.talks && <section className="mt-6 rounded-2xl border border-ks-gold/40 p-5"><h2 className="font-display text-xl text-ks-gold">{t('Transfer talks')} · {world.clubs[career.talks.clubId].name}</h2><p className="text-xs text-ks-muted mt-2">{career.talks.status === 'pending' ? `${t('Decision due')} ${career.talks.ready}` : career.talks.status === 'rejected' ? t('Counteroffer rejected') : t('Ready to sign') } · {world.associations[world.clubs[career.talks.clubId].associationId].currency} {(career.talks.annualWage / 100).toLocaleString()} / {t('year')}</p><div className="flex flex-wrap gap-2 mt-3">{career.talks.status === 'ready' && <><button onClick={() => run(() => sign(career.talks!.clubId))} className="rounded-lg bg-ks-gold text-ks-black px-3 min-h-11">{t('Accept transfer')}</button>{!career.talks.countered && <button onClick={() => run(counter)} className="rounded-lg border border-ks-gold px-3 min-h-11">{t('Counter')}</button>}</>}<button onClick={() => run(decline)} className="rounded-lg border border-ks-border px-3 min-h-11">{t('Cancel talks')}</button></div></section>}
        {tab === 'club' && !!transfers.length && !career.talks && <section className="mt-6"><h2 className="font-display text-ks-gold">{t('Transfer interest')}</h2>{transfers.map(move => <button key={move.clubId} onClick={() => run(() => beginTalks(move.clubId, true))} className="w-full text-left rounded-xl border border-ks-border p-3 mt-2 text-sm">{world.clubs[move.clubId].name} · {world.associations[world.clubs[move.clubId].associationId].currency} {(move.annualWage / 100).toLocaleString()} / {t('year')} →</button>)}</section>}
        {tab === 'club' && !!loans.length && !career.talks && <section className="mt-6"><h2 className="font-display text-ks-gold">{t('Loan opportunities')}</h2>{loans.map(id => <button key={id} onClick={() => run(() => acceptLoan(id))} className="w-full text-left rounded-xl border border-ks-border p-3 mt-2 text-sm">{world.clubs[id].name} · {t('160-day loan')} →</button>)}</section>}
        {tab === 'fixtures' && club && <section className="mt-7"><h2 className="font-display text-ks-gold uppercase tracking-widest">{t('Next fixtures')}</h2>
          {fixtures.map(fixture => { const opponent = world.clubs[fixture.homeId === club.id ? fixture.awayId : fixture.homeId]
            return <div key={fixture.id} className="border-b border-ks-border py-3 text-sm flex justify-between"><span>{opponent?.name}</span><span className="text-ks-muted">{fixture.kickoffDate}</span></div> })}
        </section>}
        {tab === 'fixtures' && club && <ProWorldPanel world={world} clubId={club.id} nationalityId={getNation(player.nationality).id} />}
        {tab === 'home' && career.pendingEvent && <section className="mt-7 rounded-2xl border border-ks-gold/60 bg-ks-gold/10 p-5"><div className="text-xs text-ks-gold uppercase tracking-widest">{t('Club invitation')}</div><h2 className="font-display text-2xl mt-2">{t(career.pendingEvent.title)}</h2><p className="text-sm text-ks-muted mt-2">{t(career.pendingEvent.detail)}</p><div className="mt-4 space-y-2">{career.pendingEvent.choices.map((choice, index) => <button key={choice} onClick={() => resolveEvent(index as 0 | 1)} className="w-full min-h-12 rounded-xl border border-ks-gold/40 text-left px-4">{t(choice)}</button>)}</div></section>}
        {tab === 'home' && <section className="mt-7"><h2 className="font-display text-ks-gold uppercase tracking-widest">{career.stage === 'trial' ? t('Today’s assessment') : t('Plan today')}</h2>
          <p className="text-sm text-ks-muted mt-1">{t('Choose one daytime activity. A scheduled match still takes place later that day.')}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">{ACTIONS.map(action => <button type="button" key={action.id} disabled={busy || !!career.pendingEvent || action.id === 'train' && !!career.injuryUntil && career.injuryUntil >= career.date} onClick={() => run(() => advance(action.id))} className="min-h-24 border border-ks-gold/35 bg-white/[.03] rounded-2xl p-4 text-left active:scale-[.98] disabled:opacity-50"><span className="block font-display text-lg text-ks-ink">{t(action.title)}</span><span className="block text-xs text-ks-muted mt-1">{t(action.detail)}</span></button>)}</div>
        </section>}
        {tab === 'home' && <section className="mt-7"><h2 className="font-display text-ks-gold uppercase tracking-widest">{t('Recent days')}</h2>
          {career.days.slice(-5).reverse().map(day => <div key={day.date} className="border-b border-ks-border py-3"><div className="text-xs text-ks-muted">{day.date}</div><p className="text-sm mt-1">{t(day.event)}</p></div>)}
        </section>}
        {tab === 'player' && career.stage === 'signed' && <button type="button" onClick={() => { if (window.confirm(t('Retire from professional football? This ends your playing career.'))) run(retire) }} className="mt-10 text-xs text-ks-muted underline">{t('Retire from football')}</button>}
      </>}
    </div>
    {signed && <BottomNav active={tab} onSelect={setTab} />}
  </main>
}
