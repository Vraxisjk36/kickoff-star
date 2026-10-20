import type { ProWorldState } from './proWorld'
/** Fictional football-world clubs, deliberately evocative of recognizable
 * city histories and club traditions without using protected names/crests.
 * Stable array order preserves the country's long-lived world-club IDs.
 */
export const PRO_TOP_FLIGHT_IDENTITIES: Readonly<Record<string, readonly string[]>> = {
  eng: ['Manchester Sky','North London Gunners','Merseyside Reds','West London Blues','Manchester Red Devils','North London Lilywhites','Tyneside Magpies','Birmingham Villans','West London Cottagers','Brighton Seagulls','East London Hammers','Nottingham Forest Reds','South London Eagles','Merseyside Toffees','West London Bees','South Coast Saints','Wolverhampton Gold','Leicester Foxes','Leeds Whites','Suffolk Tractor Boys'],
  esp: ['Madrid Royals','Catalonia Blaugrana','Madrid Red & White','Basque Lions','San Sebastián Royals','Villarreal Yellow Submarine','Seville Andalusians','Seville Green & White','Valencia Bats','Girona Reds','Vigo Celts','Pamplona Reds','Getafe Azulones','Espanyol Parakeets','Mallorca Islanders','Las Palmas Canaries','Rayo Vallecano Bolts','Alavés Blue & White','Valladolid Violets','Leganés Pepineros'],
  ger: ['Munich Bavarians','Dortmund Yellow Wall','Leverkusen Works','Leipzig Red Bulls','Stuttgart Swabians','Frankfurt Eagles','Freiburg Breisgau','Wolfsburg Wolves','Mönchengladbach Foals','Bremen River Green','Hoffenheim Village','Mainz Carnival','Berlin Iron','Augsburg Fugger','Hamburg Red Shorts','Bochum Ruhr','Heidenheim Alb','Kiel Storks'],
  fra: ['Paris Saint Lights','Marseille Phoceans','Monaco Principality','Lyon Rhône','Lille Mastiffs','Nice Riviera','Lens Blood & Gold','Rennes Brittany','Strasbourg Alsace','Brest Pirates','Nantes Canaries','Toulouse Violets','Montpellier Orange','Reims Champagne','Le Havre Normandy','Auxerre Burgundy','Angers Black & White','Saint Étienne Greens'],
  ita: ['Turin Old Lady','Milan Black & Blue','Milan Red & Black','Naples Azzurri','Rome Wolves','Rome Eagles','Bergamo Black & Blue','Florence Violets','Bologna Red & Blue','Turin Bulls','Como Lake','Genoa Griffins','Genoa Sailors','Udine Zebras','Verona Mastiffs','Lecce Salento','Parma Crusaders','Cagliari Islanders','Empoli Tuscan','Venice Lions'],
  ned: ['Amsterdam Red & White','Eindhoven Red Lights','Rotterdam South','Rotterdam Red Castle','Alkmaar Cheeseheads','Enschede Reds','Utrecht Dom','Nijmegen Red & Green','Deventer Eagles','Groningen Pride','Heerenveen Frisian','Arnhem Eagles','Zwolle Bluefingers','Sittard Gold','Tilburg Tricolours','Breda Yellow & Black','Heracles Almelo','Waalwijk Yellow'],
  por: ['Lisbon Eagles','Porto Dragons','Lisbon Lions','Braga Archbishops','Guimarães Conquerors','Famalicão Blue','Rio Ave Green','Estoril Canaries','Gil Vicente Barcelos','Moreirense Green & White','Casa Pia Geese','Arouca Wolves','Boavista Checkers','Santa Clara Azores','Nacional Madeira','Farense Algarve','Estrela Amadora','AVS Vila'],
  bra: ['Rio Flamengo Scarlet','São Paulo Palmeiras Green','São Paulo Corinthians','Santos Coast','Rio Fluminense Tricolor','Rio Vasco Sailors','Belo Horizonte Cruzeiro','Belo Horizonte Atlético','Porto Alegre Grêmio','Porto Alegre Internacional','São Paulo Tricolor','Salvador Bahia Blue','Salvador Vitória','Curitiba Athletico','Curitiba Coritiba','Recife Sport Lions','Fortaleza Lions','Fortaleza Ceará','Bragança Red Bulls','Goiânia Emerald'],
  rsa: ['Soweto Chiefs','Soweto Buccaneers','Pretoria Sundowns','Cape Town Citizens','Stellenbosch Maroons','Polokwane Rise','Sekhukhune Steel','Durban Golden Arrows','Durban AmaZulu','Richards Bay Waves','TS Galaxy Rockets','Chippa Eastern Cape','SuperSport Pretoria','Cape Town Spurs','Royal Midlands','Marumo Gallants'],
  sco: ['Glasgow Green Hoops','Glasgow Blue Rangers','Edinburgh Hearts','Edinburgh Hibernians','Aberdeen Reds','Dundee Tangerines','Dundee Dark Blues','Kilmarnock Blue','Paisley Saints','Perth Saints','Motherwell Steelmen','Ross County Stags'],
  bel: ['Brussels Purple','Bruges Blue & Black','Bruges Green & Black','Antwerp Reds','Genk Miners','Ghent Buffalos','Liège Reds','Mechelen Yellow & Red','Leuven Whites','Charleroi Zebras'],
  tur: ['Istanbul Lions','Istanbul Yellow Canaries','Istanbul Black Eagles','Trabzon Black Sea','Başakşehir Orange','Adana Blue Lightning','Samsun Red Lightning','Antalya Scorpions'],
  arg: ['Buenos Aires Blue & Gold','Buenos Aires River Reds','Avellaneda Red Devils','Avellaneda Racing Blue','La Plata Students','Rosario Central Yellow','Santa Fe Colón','Córdoba Talleres'],
  usa: ['Miami Pink','Los Angeles Gold','Los Angeles Galaxy','Atlanta United','Seattle Emerald','New York Red','New York Sky','Philadelphia Union','Columbus Gold','Cincinnati Orange'],
  mex: ['Mexico City Eagles','Guadalajara Goats','Monterrey Tigers','Monterrey Stripes','Mexico City Blue Cross','Toluca Red Devils','Pachuca Gophers','León Emerald'],
  jpn: ['Kobe Crimson','Yokohama Mariners','Kawasaki Blue','Hiroshima Purple','Urawa Red Diamonds','Osaka Cherry','Osaka Blue & Black','Kashima Antlers'],
  sau: ['Riyadh Blue Crescent','Jeddah Tigers','Riyadh Victory','Jeddah Green','Dammam Commanders','Buraidah Wolves'],
  nga: ['Enyimba Aba Elephants','Kano Pillars Red','Rivers United Blue','Enugu Rangers','Remo Stars','Shooting Stars Ibadan'],
  mar: ['Casablanca Red Eagles','Casablanca Green Eagles','Rabat Army','Berkane Orange','Fès Maghreb','Tetouan Atlético'],
  egy: ['Cairo Red Devils','Cairo White Knights','Pyramids Giza','Alexandria Union','Port Said Green','Ismailia Yellow'],
}
const CLUB_WORDS=['Athletic','United','City','Sporting','Rovers','Union','Albion','Wanderers','Olympic','Dynamo','Harbour','Racing','Eagles','Stars','Central','Lions','Valley','Academia']
const HOME_CITIES:Readonly<Record<string,readonly string[]>>={
  fra:['Paris','Marseille','Lyon','Lille','Nice','Lens','Rennes','Toulouse'],
  ita:['Turin','Milan','Rome','Naples','Genoa','Bologna','Florence','Verona'],
  ger:['Munich','Berlin','Dortmund','Hamburg','Frankfurt','Cologne','Stuttgart','Bremen'],
  eng:['London','Manchester','Liverpool','Leeds','Birmingham','Newcastle','Brighton','Bristol'],
  esp:['Madrid','Barcelona','Seville','Valencia','Bilbao','Vigo','Málaga','Zaragoza'],
}
export function proClubIdentity(country:string,index:number,tier=1,associationName=country):{name:string;city:string}{
  const top=PRO_TOP_FLIGHT_IDENTITIES[country]??[]
  if(tier===1 && index<top.length){
    const name=top[index]
    const cities=HOME_CITIES[country]??[]
    const city=cities.find(c=>name.toLowerCase().includes(c.toLowerCase())) ??
      name.split(' ').slice(0,2).join(' ')
    return {name,city}
  }
  const cities=HOME_CITIES[country]??[associationName]
  const city=cities[index%cities.length]
  const style=CLUB_WORDS[(index+Math.max(0,tier-1)*5)%CLUB_WORDS.length]
  const districts=['Riverside','Old Town','East End','Westfield','Northgate','Southbank','Hillcrest','Meadowbrook','Harbour','Market','Valley','Woodside','Highfield','Lakeside','Stonebridge','Parkside']
  const qualifiers=['Athletic','Town','United','Wanderers','County','Rovers','Borough','Sporting']
  const district= districts[Math.floor(index/cities.length)%districts.length]
  const qualifier=qualifiers[Math.floor(index/(cities.length*districts.length))%qualifiers.length]
  const name=tier>1 ? [city,district,style,qualifier].join(' ') : [city,style].join(' ')
  return {name,city}
}
/** Keep existing human club identity (contract, player story), while mapping
 * anonymous/numbered legacy AI clubs by stable position in their division.
 */
export function upgradedProClubName(name:string,country:string,rank:number,tier=1):string{
  const anonymous=/\b\d{1,3}\b|(?:North|South) (?:Athletic|United|City|Sporting)|\b(?:Rovers|Albion|Wanderers|Olympic|Union) \d+$/i.test(name)
  return anonymous ? proClubIdentity(country,rank,tier).name : name
}

/** Readable names for already-created clubs without replacing club IDs,
 * standings, results, contracts or historic achievements.
 */
export function renameLegacyProClubs(world:ProWorldState, protectedClubId?:string):ProWorldState {
  const clubs={...world.clubs}
  const grouped=new Map<string,string[]>()
  for(const club of Object.values(clubs)){
    const key=`${club.associationId}:${club.tier??1}`
    grouped.set(key,[...(grouped.get(key)??[]),club.id])
  }
  for(const [key,ids] of grouped){
    const [country,tierStr]=key.split(':')
    const tier=Number(tierStr)
    ids.sort()
    for(const [index,id] of ids.entries()){
      const club=clubs[id]
      if(id===protectedClubId)continue
      const old=club.name
      if(/\b\d{1,4}\b/.test(old) || /\b(?:North|South) (?:Athletic|United|City|Sporting)\b/i.test(old)){
        const identity=proClubIdentity(country,index,tier)
        clubs[id]={...club,name:identity.name}
      }
    }
  }
  return {...world,clubs}
}
