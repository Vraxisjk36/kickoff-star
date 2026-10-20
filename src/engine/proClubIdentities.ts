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
const COUNTRY_CITIES:Readonly<Record<string,readonly string[]>>={
  grc:['Athens','Thessaloniki','Piraeus','Patras','Heraklion'],
  aut:['Vienna','Graz','Salzburg','Linz','Innsbruck'],
  sui:['Zürich','Basel','Bern','Geneva','Lausanne'],
  dnk:['Copenhagen','Aarhus','Odense','Aalborg','Brøndby'],
  swe:['Stockholm','Gothenburg','Malmö','Uppsala','Borås'],
  nor:['Oslo','Bergen','Trondheim','Stavanger','Bodø'],
  pol:['Warsaw','Kraków','Poznań','Wrocław','Gdańsk'],
  cze:['Prague','Plzeň','Brno','Ostrava','Liberec'],
  hrv:['Zagreb','Split','Rijeka','Osijek','Pula'],
  srb:['Belgrade','Novi Sad','Niš','Kragujevac','Subotica'],
  ukr:['Kyiv','Donetsk','Lviv','Odesa','Kharkiv'],
  rou:['Bucharest','Cluj','Craiova','Iași','Constanța'],
  hun:['Budapest','Debrecen','Győr','Miskolc','Szeged'],
  bul:['Sofia','Plovdiv','Varna','Burgas','Ruse'],
  irl:['Dublin','Cork','Galway','Waterford','Limerick'],
  fin:['Helsinki','Espoo','Tampere','Turku','Oulu'],
  rsa:['Soweto','Pretoria','Cape Town','Durban','Stellenbosch','Polokwane','Gqeberha'],
  mar:['Casablanca','Rabat','Marrakech','Berkane','Fès'],
  nga:['Lagos','Abuja','Enugu','Kano','Port Harcourt'],
  gha:['Accra','Kumasi','Tamale','Cape Coast'],
  sen:['Dakar','Thiès','Saint-Louis','Kaolack'],
  civ:['Abidjan','Bouaké','Yamoussoukro','Korhogo'],
  cod:['Kinshasa','Lubumbashi','Goma','Matadi'],
  cmr:['Douala','Yaoundé','Bafoussam','Garoua'],
  ken:['Nairobi','Mombasa','Kisumu','Nakuru'],
  tza:['Dar es Salaam','Dodoma','Arusha','Mwanza'],
  uga:['Kampala','Entebbe','Jinja','Gulu'],
  zmb:['Lusaka','Ndola','Kitwe','Livingstone'],
  ago:['Luanda','Benguela','Huambo','Lubango'],
  mli:['Bamako','Sikasso','Ségou','Mopti'],
  moz:['Maputo','Beira','Nampula','Matola'],
  zwe:['Harare','Bulawayo','Mutare','Gweru'],
  eth:['Addis Ababa','Bahir Dar','Hawassa','Dire Dawa'],
  rwa:['Kigali','Butare','Rubavu','Musanze'],
  lby:['Tripoli','Benghazi','Misrata','Sabha'],
  ben:['Cotonou','Porto-Novo','Parakou','Ouidah'],
  bfa:['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'],
  dza:['Algiers','Oran','Constantine','Tizi Ouzou'],
  egy:['Cairo','Alexandria','Giza','Ismailia','Port Said'],
  tun:['Tunis','Sfax','Sousse','Bizerte'],
  arg:['Buenos Aires','Avellaneda','Rosario','Córdoba','La Plata'],
  col:['Bogotá','Medellín','Cali','Barranquilla'],
  ury:['Montevideo','Maldonado','Paysandú','Rivera'],
  chl:['Santiago','Valparaíso','Concepción','La Serena'],
  ecu:['Quito','Guayaquil','Cuenca','Ambato'],
  pry:['Asunción','Luque','Encarnación','Ciudad del Este'],
  per:['Lima','Arequipa','Cusco','Trujillo'],
  bol:['La Paz','Santa Cruz','Cochabamba','Sucre'],
  ven:['Caracas','Maracaibo','Barquisimeto','Valencia'],
  can:['Toronto','Vancouver','Montréal','Ottawa','Calgary'],
  cri:['San José','Alajuela','Heredia','Cartago'],
  hnd:['Tegucigalpa','San Pedro Sula','La Ceiba','Comayagua'],
  pan:['Panama City','Colón','David','Santiago'],
  gtm:['Guatemala City','Antigua','Quetzaltenango','Mixco'],
  slv:['San Salvador','Santa Ana','San Miguel','Sonsonate'],
  nic:['Managua','León','Granada','Masaya'],
  jam:['Kingston','Montego Bay','Portmore','Spanish Town'],
  tto:['Port of Spain','San Fernando','Chaguanas','Arima'],
  hti:['Port-au-Prince','Cap-Haïtien','Jacmel','Gonaïves'],
  cur:['Willemstad','Sint Michiel','Otrobanda','Santa Rosa'],
  dom:['Santo Domingo','Santiago','La Vega','San Pedro'],
  sur:['Paramaribo','Lelydorp','Nieuw Nickerie','Moengo'],
  guy:['Georgetown','Linden','New Amsterdam','Bartica'],
  jpn:['Tokyo','Yokohama','Osaka','Kobe','Hiroshima'],
  kor:['Seoul','Busan','Ulsan','Jeonju','Daegu'],
  sau:['Riyadh','Jeddah','Dammam','Taif','Mecca'],
  ind:['Mumbai','Kolkata','Goa','Bengaluru','Hyderabad'],
  chn:['Shanghai','Beijing','Guangzhou','Shenzhen','Chengdu'],
  aus:['Sydney','Melbourne','Adelaide','Brisbane','Perth'],
  irn:['Tehran','Isfahan','Tabriz','Mashhad','Ahvaz'],
  are:['Dubai','Abu Dhabi','Sharjah','Al Ain','Ajman'],
  qat:['Doha','Al Wakrah','Al Rayyan','Lusail'],
  tha:['Bangkok','Chiang Mai','Buriram','Chonburi'],
  idn:['Jakarta','Bandung','Surabaya','Bali','Malang'],
  uzb:['Tashkent','Samarkand','Bukhara','Namangan'],
  vnm:['Hanoi','Ho Chi Minh City','Da Nang','Hai Phong'],
  irq:['Baghdad','Basra','Erbil','Najaf'],
  jor:['Amman','Irbid','Zarqa','Aqaba'],
  oma:['Muscat','Salalah','Sohar','Nizwa'],
  bhr:['Manama','Muharraq','Riffa','Isa Town'],
  kwt:['Kuwait City','Hawalli','Farwaniya','Jahra'],
  mas:['Kuala Lumpur','Johor Bahru','Penang','Kuching'],
  phi:['Manila','Cebu','Davao','Quezon City'],
  nzl:['Auckland','Wellington','Christchurch','Hamilton'],
  fji:['Suva','Nadi','Lautoka','Labasa'],
  sol:['Honiara','Gizo','Auki','Kirakira'],
  png:['Port Moresby','Lae','Madang','Mount Hagen'],
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
    const cities=HOME_CITIES[country]??COUNTRY_CITIES[country]??[]
    const city=cities.find(c=>name.toLowerCase().includes(c.toLowerCase())) ??
      name.split(' ').slice(0,2).join(' ')
    return {name,city}
  }
  const cities=HOME_CITIES[country]??COUNTRY_CITIES[country]??[associationName]
  const city=cities[index%cities.length]
  const style=CLUB_WORDS[(index+Math.max(0,tier-1)*5)%CLUB_WORDS.length]
  const districts=['Riverside','Old Town','East End','Westfield','Northgate','Southbank','Hillcrest','Meadowbrook','Harbour','Market','Valley','Woodside','Highfield','Lakeside','Stonebridge','Parkside']
  const qualifiers=['Athletic','Town','United','Wanderers','County','Rovers','Borough','Sporting']
  const district= districts[Math.floor(index/cities.length)%districts.length]
  const qualifier=qualifiers[Math.floor(index/(cities.length*districts.length))%qualifiers.length]
  // Lower-league sides use grounded city + neighbourhood + club suffix,
  // rather than four-word procedural strings or arbitrary "Paris 17" labels.
  // Only cycle the suffix if the district group itself repeats.
  const name=tier>1 ? [city,district,Math.floor(index/(cities.length*districts.length))>0?qualifier:style].join(' ')
    : [city,style].join(' ')
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
      const currentAliases=PRO_TOP_FLIGHT_IDENTITIES[country]??[]
      if((tier===1 && currentAliases.length && !currentAliases.includes(old)) ||
        /\b\d{1,4}\b/.test(old) ||
        /\b(?:North|South) (?:Athletic|United|City|Sporting)\b/i.test(old)){
        const identity=proClubIdentity(country,index,tier)
        clubs[id]={...club,name:identity.name}
      }
    }
  }
  return {...world,clubs}
}
