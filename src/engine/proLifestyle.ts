export type LuxuryKind = 'house' | 'car' | 'plane' | 'boat'
export interface LuxuryAsset { id: string; kind: LuxuryKind; name: string; price: number; upkeepWeekly: number; location: string; purchasedSeason: number; purchasedWeek: number }
export interface LuxuryListing { id: string; kind: LuxuryKind; name: string; price: number; upkeepWeekly: number; location: string }
const houseStyles = ['Studio Flat','Garden Apartment','Loft Residence','Terraced House','Townhouse','Riverside Duplex','Penthouse','Country Cottage','Hillcrest Villa','Waterfront Estate','Heritage Manor','Contemporary Mansion','Lakeside Retreat','Clifftop Residence']
const housePlaces = ['Camden','Brighton','Manchester','Leeds','Edinburgh','Porto','Lisbon','Amsterdam','Rotterdam','Barcelona','Valencia','Milan','Turin','Munich','Berlin','Cape Town','Johannesburg','Paris','Lyon','Marseille']
const carModels = [
  'Dacia Sandero','Renault Clio','Toyota Yaris','Volkswagen Polo','Ford Fiesta','Hyundai i20','Peugeot 208','Honda Civic','Toyota Corolla','Volkswagen Golf',
  'Mazda MX-5','Mini Cooper S','Audi A3','BMW 320i','Mercedes-Benz C200','Volvo XC60','Tesla Model 3','Lexus IS 350','Alfa Romeo Giulia','Audi S5',
  'BMW M3','Mercedes-AMG C63','Porsche Macan','Jaguar F-Type','Range Rover Sport','Audi RS6 Avant','BMW M5','Porsche 911 Carrera','Nissan GT-R','Mercedes-AMG GT',
  'Aston Martin Vantage','Maserati MC20','Porsche 911 Turbo S','Bentley Continental GT','Ferrari Roma','Lamborghini Huracán','McLaren 750S','Rolls-Royce Ghost','Ferrari SF90 Stradale','Bugatti Chiron']
const planeModels = ['Cessna 172 Skyhawk','Piper PA-28 Archer','Diamond DA40','Cirrus SR22','Beechcraft Bonanza G36','Piper M350','Cessna 182 Skylane','Pilatus PC-12 NGX','Daher TBM 960','King Air 260','King Air 360','HondaJet Elite II','Embraer Phenom 100EX','Cessna Citation M2','Embraer Phenom 300E','Pilatus PC-24','Cessna Citation Latitude','Bombardier Challenger 3500','Dassault Falcon 8X','Gulfstream G700']
const boatModels = ['Sun Dolphin Aruba Kayak','Laser Pico Dinghy','Bayliner Element M15','Quicksilver Activ 455','Boston Whaler 130 Super Sport','Sea Ray SPX 190','Yamaha 212SD','Jeanneau Merry Fisher 695','Beneteau Flyer 8','Axopar 28 Cabin','Sea Ray Sundancer 320','Jeanneau NC 37','Princess V40','Azimut Atlantis 45','Sunseeker Predator 50','Fairline Targa 65','Princess Y72','Azimut Grande 27M','Sunseeker 95 Yacht','Lürssen 85m Superyacht']
const money = (low:number,high:number,index:number,count:number) => Math.round(low*Math.pow(high/low,index/(count-1))/100)*100
export const LUXURY_CATALOG: readonly LuxuryListing[] = [
  ...Array.from({length:70},(_,i) => {
    const style=houseStyles[i%houseStyles.length],place=housePlaces[Math.floor(i/houseStyles.length)*4+i%4 < housePlaces.length ? (Math.floor(i/houseStyles.length)*4+i%4) : i%housePlaces.length]
    const price=money(45000,55000000,i,70)
    return {id:`house-${i+1}`,kind:'house' as const,name:`${place} ${style} ${String(i+1).padStart(2,'0')}`,price,upkeepWeekly:Math.round(price*.000025),location:place}
  }),
  ...carModels.map((name,i)=>{const price=money(9000,3800000,i,40);return {id:`car-${i+1}`,kind:'car' as const,name,price,upkeepWeekly:Math.round(price*.00018),location:'Dealership'}}),
  ...planeModels.map((name,i)=>{const price=money(95000,85000000,i,20);return {id:`plane-${i+1}`,kind:'plane' as const,name,price,upkeepWeekly:Math.round(price*.00045),location:'Aviation broker'}}),
  ...boatModels.map((name,i)=>{const price=money(1200,125000000,i,20);return {id:`boat-${i+1}`,kind:'boat' as const,name,price,upkeepWeekly:Math.round(price*.00028),location:'Marina broker'}}),
]
const WEEKLY_COUNTS: Record<LuxuryKind,number> = {house:7,car:6,plane:4,boat:4}
function hash(seed:string):number {let h=2166136261;for(const c of seed){h=Math.imul(h^c.charCodeAt(0),16777619)}return h>>>0}
export function weeklyLuxuryListings(kind:LuxuryKind,season:number,week:number,seed:string,owned:readonly LuxuryAsset[]=[]):LuxuryListing[] {
  const available=LUXURY_CATALOG.filter(item=>item.kind===kind&&!owned.some(asset=>asset.id===item.id))
  return available.map(item=>({item,order:hash(`${seed}:${season}:${week}:${item.id}`)}))
    .sort((a,b)=>a.order-b.order||a.item.id.localeCompare(b.item.id))
    .slice(0,WEEKLY_COUNTS[kind]).map(entry=>entry.item)
}
export function purchaseLuxuryAsset(balance:number,assets:readonly LuxuryAsset[],listingId:string,season:number,week:number,seed:string):
  {money:number;assets:LuxuryAsset[];error?:string} {
  const item=LUXURY_CATALOG.find(listing=>listing.id===listingId)
  if(!item)return {money:balance,assets:[...assets],error:'Unknown listing'}
  if(assets.some(asset=>asset.id===item.id))return {money:balance,assets:[...assets],error:'Already owned'}
  if(!weeklyLuxuryListings(item.kind,season,week,seed,assets).some(listing=>listing.id===item.id))
    return {money:balance,assets:[...assets],error:'Listing is no longer available'}
  if(balance<item.price)return {money:balance,assets:[...assets],error:'Insufficient funds'}
  return {money:balance-item.price,assets:[...assets,{...item,purchasedSeason:season,purchasedWeek:week}]}
}
export function luxuryNetWorth(assets:readonly LuxuryAsset[]):number{return assets.reduce((total,asset)=>total+asset.price,0)}
export function luxuryWeeklyUpkeep(assets:readonly LuxuryAsset[]):number{return assets.reduce((total,asset)=>total+asset.upkeepWeekly,0)}
