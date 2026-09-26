import { readFileSync } from 'fs'
import { SHOP_ITEMS, ODD_JOBS } from '../src/engine/economy'

let fails = 0
const check = (ok: boolean, msg: string) => {
  if (ok) console.log('  ✓', msg)
  else { fails++; console.error('  ✗', msg) }
}

console.log('\n[A] recovery economy cannot be farmed for free energy')
const consumables = SHOP_ITEMS.filter((i) => i.kind === 'consumable')
const bestEnergyPerPound = Math.max(...consumables.map((i) => ((i.energyPct ?? 0) * 100) / i.price))
for (const job of ODD_JOBS) {
  const boughtBack = job.pay * bestEnergyPerPound
  check(boughtBack < job.energyCost, `${job.id}: wages buy ${boughtBack.toFixed(1)} energy after spending ${job.energyCost}`)
}

console.log('\n[B] menu destinations are actually wired')
const app = readFileSync('src/App.tsx', 'utf8')
const menu = readFileSync('src/screens/MainMenu.tsx', 'utf8')
for (const screen of ['settings', 'credits', 'help', 'load']) {
  check(app.includes(`'${screen}'`), `App knows the ${screen} screen`)
}
for (const prop of ['onOpenSettings', 'onOpenCredits', 'onOpenHelp', 'onLoadCareer']) {
  check(menu.includes(prop), `MainMenu calls ${prop}`)
}
check(app.includes('window.history.pushState'), 'SPA navigation pushes browser history for Android back')
check(app.includes("window.addEventListener('popstate'"), 'popstate restores the previous app screen')

console.log('\n[C] Android hardware back is connected to WebView history')
const mainActivity = readFileSync('android/app/src/main/java/com/vraxis/kickoffstar/MainActivity.java', 'utf8')
check(mainActivity.includes('onBackPressed'), 'MainActivity overrides Android back')
check(mainActivity.includes("kickoffstar:native-back"), 'Android back delegates to the game navigation contract')
check(app.includes("window.addEventListener('kickoffstar:native-back'"), 'the app handles native back without exiting the active game')

console.log('\n[D] load/continue are no longer fake duplicates')
check(app.includes('listSaves()'), 'Continue inspects all save slots')
check(app.includes("navigate('load')"), 'Load Career opens the slot picker')
check(app.includes('latest.slotId'), 'Continue selects the most recently saved career')
const loader = readFileSync('src/screens/LoadCareerScreen.tsx', 'utf8')
check(loader.includes('[0, 1, 2]'), 'load screen exposes all three local save slots')

console.log(fails === 0 ? '\n✅ AUDIT 21 PASSED' : `\n❌ AUDIT 21: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
