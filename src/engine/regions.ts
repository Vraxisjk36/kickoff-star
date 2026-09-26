// Game regions anchor the local youth world. IDs are stable save identifiers;
// locality names give each region its own school and community club pool.
export interface Region { id: string; countryId: string; name: string; localities: readonly [string, string, string] }

const AREAS: Record<string, readonly (readonly [string, string, string, string])[]> = {
  eng: [
    ['London', 'Camden', 'Croydon', 'Hackney'], ['North West', 'Manchester', 'Liverpool', 'Preston'],
    ['North East', 'Newcastle', 'Sunderland', 'Durham'], ['Yorkshire', 'Leeds', 'Sheffield', 'York'],
    ['West Midlands', 'Birmingham', 'Coventry', 'Wolverhampton'], ['East Midlands', 'Nottingham', 'Leicester', 'Derby'],
    ['East of England', 'Norwich', 'Cambridge', 'Ipswich'], ['South East', 'Brighton', 'Oxford', 'Reading'],
    ['South West', 'Bristol', 'Plymouth', 'Exeter'],
  ],
  rsa: [
    ['Eastern Cape', 'Gqeberha', 'East London', 'Mthatha'], ['Free State', 'Bloemfontein', 'Welkom', 'Bethlehem'],
    ['Gauteng', 'Johannesburg', 'Pretoria', 'Soweto'], ['KwaZulu-Natal', 'Durban', 'Pietermaritzburg', 'Newcastle KZN'],
    ['Limpopo', 'Polokwane', 'Tzaneen', 'Thohoyandou'], ['Mpumalanga', 'Mbombela', 'eMalahleni', 'Middelburg'],
    ['North West', 'Rustenburg', 'Potchefstroom', 'Mahikeng'], ['Northern Cape', 'Kimberley', 'Upington', 'De Aar'],
    ['Western Cape', 'Cape Town', 'Stellenbosch', 'George'],
  ],
  bra: [['São Paulo', 'São Paulo', 'Campinas', 'Santos'], ['Rio de Janeiro', 'Rio', 'Niterói', 'Petrópolis'], ['Bahia', 'Salvador', 'Feira de Santana', 'Ilhéus'], ['Minas Gerais', 'Belo Horizonte', 'Uberlândia', 'Juiz de Fora']],
  arg: [['Buenos Aires', 'La Plata', 'Avellaneda', 'Quilmes'], ['Córdoba', 'Córdoba', 'Río Cuarto', 'Villa María'], ['Santa Fe', 'Rosario', 'Santa Fe', 'Rafaela'], ['Mendoza', 'Mendoza', 'Godoy Cruz', 'San Rafael']],
  fra: [['Île-de-France', 'Paris', 'Saint-Denis', 'Versailles'], ['Provence', 'Marseille', 'Aix', 'Toulon'], ['Auvergne-Rhône-Alpes', 'Lyon', 'Grenoble', 'Saint-Étienne'], ['Occitanie', 'Toulouse', 'Montpellier', 'Nîmes']],
  ger: [['Bavaria', 'Munich', 'Augsburg', 'Nuremberg'], ['North Rhine-Westphalia', 'Dortmund', 'Cologne', 'Düsseldorf'], ['Berlin', 'Berlin', 'Spandau', 'Köpenick'], ['Baden-Württemberg', 'Stuttgart', 'Freiburg', 'Karlsruhe']],
  esp: [['Madrid', 'Madrid', 'Getafe', 'Alcalá'], ['Catalonia', 'Barcelona', 'Badalona', 'Terrassa'], ['Andalusia', 'Seville', 'Málaga', 'Granada'], ['Valencia', 'Valencia', 'Alicante', 'Castellón']],
  por: [['Lisbon', 'Lisbon', 'Amadora', 'Sintra'], ['Porto', 'Porto', 'Matosinhos', 'Vila Nova de Gaia'], ['Braga', 'Braga', 'Guimarães', 'Famalicão'], ['Algarve', 'Faro', 'Portimão', 'Loulé']],
  ita: [['Lombardy', 'Milan', 'Bergamo', 'Brescia'], ['Lazio', 'Rome', 'Latina', 'Viterbo'], ['Piedmont', 'Turin', 'Novara', 'Asti'], ['Campania', 'Naples', 'Salerno', 'Caserta']],
  ned: [['North Holland', 'Amsterdam', 'Haarlem', 'Alkmaar'], ['South Holland', 'Rotterdam', 'The Hague', 'Leiden'], ['North Brabant', 'Eindhoven', 'Tilburg', 'Breda'], ['Utrecht', 'Utrecht', 'Amersfoort', 'Zeist']],
  nga: [['Lagos', 'Ikeja', 'Lekki', 'Surulere'], ['Abuja', 'Garki', 'Wuse', 'Gwagwalada'], ['Kano', 'Kano', 'Dala', 'Tarauni'], ['Rivers', 'Port Harcourt', 'Obio-Akpor', 'Bonny']],
  gha: [['Greater Accra', 'Accra', 'Tema', 'Madina'], ['Ashanti', 'Kumasi', 'Obuasi', 'Ejisu'], ['Central', 'Cape Coast', 'Winneba', 'Elmina'], ['Northern', 'Tamale', 'Yendi', 'Savelugu']],
  sen: [['Dakar', 'Dakar', 'Pikine', 'Rufisque'], ['Thiès', 'Thiès', 'Mbour', 'Tivaouane'], ['Saint-Louis', 'Saint-Louis', 'Richard Toll', 'Dagana'], ['Ziguinchor', 'Ziguinchor', 'Bignona', 'Oussouye']],
  mar: [['Casablanca-Settat', 'Casablanca', 'Mohammedia', 'El Jadida'], ['Rabat-Salé-Kénitra', 'Rabat', 'Salé', 'Kénitra'], ['Marrakesh-Safi', 'Marrakesh', 'Safi', 'Essaouira'], ['Fès-Meknès', 'Fès', 'Meknès', 'Sefrou']],
  usa: [['New York', 'Brooklyn', 'Queens', 'Buffalo'], ['California', 'Los Angeles', 'San Diego', 'Sacramento'], ['Texas', 'Houston', 'Dallas', 'Austin'], ['Florida', 'Miami', 'Orlando', 'Tampa']],
  mex: [['Mexico City', 'Coyoacán', 'Iztapalapa', 'Tlalpan'], ['Jalisco', 'Guadalajara', 'Zapopan', 'Tlaquepaque'], ['Nuevo León', 'Monterrey', 'San Nicolás', 'Guadalupe'], ['Puebla', 'Puebla', 'Tehuacán', 'Atlixco']],
  jpn: [['Tokyo', 'Shinjuku', 'Setagaya', 'Adachi'], ['Osaka', 'Osaka', 'Sakai', 'Higashiosaka'], ['Kanagawa', 'Yokohama', 'Kawasaki', 'Sagamihara'], ['Aichi', 'Nagoya', 'Toyota', 'Okazaki']],
  kor: [['Seoul', 'Gangnam', 'Mapo', 'Songpa'], ['Gyeonggi', 'Suwon', 'Seongnam', 'Goyang'], ['Busan', 'Haeundae', 'Dongnae', 'Saha'], ['Incheon', 'Bupyeong', 'Namdong', 'Yeonsu']],
  aus: [['New South Wales', 'Sydney', 'Newcastle NSW', 'Wollongong'], ['Victoria', 'Melbourne', 'Geelong', 'Ballarat'], ['Queensland', 'Brisbane', 'Gold Coast', 'Cairns'], ['Western Australia', 'Perth', 'Fremantle', 'Bunbury']],
  bel: [['Brussels', 'Brussels', 'Anderlecht', 'Ixelles'], ['Flanders', 'Antwerp', 'Ghent', 'Bruges'], ['Wallonia', 'Liège', 'Namur', 'Charleroi']],
}

function slug(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
export const REGIONS: Region[] = Object.entries(AREAS).flatMap(([countryId, rows]) => rows.map(([name, a, b, c]) => ({ id: `${countryId}-${slug(name)}`, countryId, name, localities: [a, b, c] as const })))
export function regionsFor(countryId: string): Region[] { return REGIONS.filter(region => region.countryId === countryId) }
export function getRegion(regionId: string | null | undefined): Region | undefined { return REGIONS.find(region => region.id === regionId) }
export function regionalSchoolNames(regionId: string): string[] {
  const region = getRegion(regionId)
  if (!region) return []
  const suffixes = ['High', 'Secondary', 'College', 'Academy', 'Community School', 'Technical High', 'Central High', 'North High', 'South High', 'West High', 'East High', 'Sports School']
  return suffixes.flatMap(suffix => region.localities.map(place => `${place} ${suffix}`))
}
export function regionalClubNames(regionId: string): string[] {
  const region = getRegion(regionId)
  if (!region) return []
  const suffixes = ['Athletic', 'United', 'Juniors', 'Rovers', 'City', 'Town', 'Sporting', 'Wanderers', 'Rangers', 'Stars', 'FC', 'Youth']
  return suffixes.flatMap(suffix => region.localities.map(place => `${place} ${suffix}`))
}
