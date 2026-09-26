import type { Player } from '../types/player'
import type { CalendarState } from '../types/calendar'
import type { CupWorlds } from '../engine/save'
import { activeCompetitionForWeek, internationalRoundForWeek, SEASON_WEEKS } from '../engine/calendar'
import { monthForWeek } from '../engine/pathway'

type CalendarItem = { label: string; tone: 'match' | 'pathway' | 'window' | 'rest' }

function weekItems(week: number, current: number, player: Player, cups: CupWorlds): CalendarItem[] {
  const academy = player.careerClock.phase === 'academy'
  const school = !academy && player.grassrootsPath === 'school'
  if (!academy && week <= 3) return [{ label: 'Preseason trials', tone: 'window' }]

  const items: CalendarItem[] = []
  const fixture = activeCompetitionForWeek(week, player.careerClock.phase, player.grassrootsPath, Boolean(cups.schoolDevelopment))
  const names: Record<string, string> = {
    schoolFriendlies: 'School friendly', schoolLeague: 'Local School League',
    schoolCup: 'Regional Schools Cup', schoolDevelopment: 'School Development Competition',
    nationalChampionship: 'National Schools Championship', sundayLeague: academy ? 'Academy League' : 'Sunday League',
    sundayCup: 'Sunday Cup', academyLeagueCup: 'Academy League Cup',
    academyKnockoutCup: 'Academy Knockout Cup', academyChampionsCup: 'Academy Champions Cup', youthShowcase: 'October academy showcase',
  }
  if (fixture?.competitionId === 'youthShowcase' && !academy && player.careerClock.ageYears <= 15) {
    // The 16+ showcase is replaced by the October development fixture below.
  } else if (school && week >= 24 && week <= 28 && current <= 23) {
    items.push({ label: 'Regional Cup / development route', tone: 'window' })
  } else if (fixture?.competitionId === 'academyChampionsCup' && current > 23 && !cups.academyChampionsCup) {
    items.push({ label: 'Academy training', tone: 'rest' })
  } else if (fixture) {
    items.push({ label: names[fixture.competitionId] ?? fixture.competitionId, tone: 'match' })
  }
  if (school && week === 23) items.push({ label: 'Local league final table', tone: 'pathway' })
  if (school && week >= 29 && week <= 31) items.push({ label: 'Regional XI selection window', tone: 'pathway' })
  if (school && week >= 35 && week <= 36) items.push({ label: 'National selection window', tone: 'pathway' })
  if (!academy && player.careerClock.ageYears <= 15 && week >= 36 && week <= 39) {
    items.push({ label: `October Development Series · ${week - 35}/4`, tone: 'match' })
  } else if (!academy && week >= 36 && week <= 38) {
    items.push({ label: 'Academy assessment window', tone: 'window' })
  }
  if (player.pathway?.nationalSelection === 'selected' && internationalRoundForWeek(week)) {
    items.push({ label: 'International duty · Wednesday', tone: 'pathway' })
  }
  if (week === SEASON_WEEKS) items.push({ label: 'Season review & transfer window', tone: 'window' })
  if (!items.length) items.push({ label: 'Training & recovery', tone: 'rest' })
  return items
}

export default function YearCalendarScreen({ player, calendar, cups, onClose }: {
  player: Player; calendar: CalendarState; cups: CupWorlds; onClose: () => void
}) {
  const current = calendar.currentWeek.weekNumber
  const months = Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).reduce<Record<string, number[]>>((grouped, week) => {
    const month = monthForWeek(week)
    ;(grouped[month] ??= []).push(week)
    return grouped
  }, {})

  return (
    <div className="fixed inset-0 z-40 bg-ks-black overflow-y-auto" role="dialog" aria-modal="true" aria-label="Year calendar">
      <div className="max-w-md mx-auto min-h-full px-4 pb-8">
        <header className="sticky top-0 z-10 bg-ks-black/95 backdrop-blur py-5 border-b border-ks-gold/40 flex items-start justify-between gap-3">
          <div><span className="font-display text-[10px] tracking-widest text-ks-gold">SEASON {calendar.currentWeek.seasonYear} · {player.careerClock.phase === 'academy' ? 'ACADEMY' : player.grassrootsPath === 'school' ? 'SCHOOL' : 'GRASSROOTS'}</span><h1 className="font-display text-2xl text-white mt-1">YEAR CALENDAR</h1><p className="text-xs text-ks-muted mt-1">Week {current} of {SEASON_WEEKS} · January to December</p></div>
          <button type="button" onClick={onClose} className="text-xs text-ks-gold p-2" aria-label="Close year calendar">close ✕</button>
        </header>
        <p className="text-[11px] text-ks-muted py-4">Cup routes, selections and invitations depend on your season results. Upcoming windows show when decisions happen.</p>
        <div className="space-y-5">
          {Object.entries(months).map(([month, weeks]) => (
            <section key={month} aria-label={month}>
              <h2 className="font-display text-sm tracking-widest text-ks-gold uppercase border-b border-ks-border pb-2 mb-2">{month}</h2>
              <div className="space-y-1.5">
                {weeks.map(week => <div key={week} className={`flex gap-3 rounded-lg border px-3 py-2 ${week === current ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border/60 bg-[#0f0f0d]'}`}>
                  <div className="w-12 shrink-0"><b className={`text-xs ${week === current ? 'text-ks-gold' : 'text-white'}`}>W{week}</b><div className="text-[9px] text-ks-muted">{week < current ? 'past' : week === current ? 'now' : 'ahead'}</div></div>
                  <div className="flex-1 space-y-1">{weekItems(week, current, player, cups).map((item, i) => <div key={i} className={`text-[11px] ${item.tone === 'match' ? 'text-white' : item.tone === 'rest' ? 'text-ks-muted' : 'text-ks-gold'}`}>{item.label}</div>)}</div>
                </div>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
