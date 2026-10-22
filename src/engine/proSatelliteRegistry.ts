import type { ProAssociation } from './proWorld'
import { PRO_LEAGUE_PLAN } from './proLeagueRegistry'

// Fictional-world background national sides. They play in association events,
// but have no domestic clubs, player pool, or player national-team route.
// Do not infer an official membership list or eligibility from this registry.
const backgrounds: Record<ProAssociation['confederation'], string> = {
  caf: `lby:Libya,cpv:Cape Verde,gam:Gambia,gui:Guinea,gnb:Guinea-Bissau,lbr:Liberia,mrt:Mauritania,sle:Sierra Leone,ben:Benin,bfa:Burkina Faso,nig:Niger,tog:Togo,stp:São Tomé and Príncipe,gab:Gabon,eqg:Equatorial Guinea,cgo:Congo,cha:Chad,caf:Central African Republic,bdi:Burundi,dji:Djibouti,eri:Eritrea,eth:Ethiopia,rwa:Rwanda,ssd:South Sudan,som:Somalia,sdn:Sudan,bwa:Botswana,com:Comoros,les:Lesotho,mdg:Madagascar,mwi:Malawi,mus:Mauritius,nam:Namibia,sey:Seychelles,swz:Eswatini,zwe:Zimbabwe`,
  uefa: `alb:Albania,and:Andorra,arm:Armenia,aze:Azerbaijan,blr:Belarus,bih:Bosnia and Herzegovina,bul:Bulgaria,cyp:Cyprus,est:Estonia,fin:Finland,geo:Georgia,gib:Gibraltar,hun:Hungary,isl:Iceland,irl:Ireland,isr:Israel,kaz:Kazakhstan,kvx:Kosovo,lva:Latvia,lie:Liechtenstein,ltu:Lithuania,lux:Luxembourg,mlt:Malta,mda:Moldova,mne:Montenegro,mkd:North Macedonia,nir:Northern Ireland,rou:Romania,rus:Russia,smr:San Marino,svk:Slovakia,svn:Slovenia,ukr:Ukraine,wls:Wales,far:Faroe Islands`,
  conmebol: ``,
  concacaf: `aia:Anguilla,bon:Bonaire,guf:French Guiana,smt:Saint Martin,atg:Antigua and Barbuda,abw:Aruba,bah:Bahamas,brb:Barbados,blz:Belize,ber:Bermuda,bmu:British Virgin Islands,cay:Cayman Islands,cub:Cuba,cur:Curaçao,dma:Dominica,dom:Dominican Republic,grn:Grenada,guy:Guyana,hti:Haiti,kna:Saint Kitts and Nevis,lca:Saint Lucia,msr:Montserrat,pri:Puerto Rico,sxm:Sint Maarten,sur:Suriname,tca:Turks and Caicos Islands,vir:US Virgin Islands,vct:Saint Vincent and the Grenadines,grd:Guadeloupe,mtq:Martinique`,
  afc: `afg:Afghanistan,gum:Guam,pak:Pakistan,nmi:Northern Mariana Islands,bhr:Bahrain,bgd:Bangladesh,btn:Bhutan,brn:Brunei,cam:Cambodia,hkg:Hong Kong,twn:Chinese Taipei,jor:Jordan,kgz:Kyrgyzstan,kwt:Kuwait,lao:Laos,lbn:Lebanon,mac:Macau,mas:Malaysia,mdv:Maldives,mng:Mongolia,mya:Myanmar,npl:Nepal,oma:Oman,phi:Philippines,pse:Palestine,sgp:Singapore,lka:Sri Lanka,syr:Syria,tjk:Tajikistan,tkm:Turkmenistan,yem:Yemen,prk:North Korea,tls:Timor-Leste`,
  ofc: `sol:Solomon Islands,van:Vanuatu,sam:Samoa,ton:Tonga,png:Papua New Guinea,cok:Cook Islands,tah:Tahiti,ncl:New Caledonia,asa:American Samoa`,
}
const full = new Set(PRO_LEAGUE_PLAN.map(item => item.associationId))
export const PRO_SATELLITE_ASSOCIATIONS: readonly ProAssociation[] = (Object.entries(backgrounds) as [ProAssociation['confederation'], string][])
  .flatMap(([confederation, names]) => names ? names.split(',').map(entry => {
    const pivot = entry.indexOf(':')
    const id = entry.slice(0, pivot)
    return { id, name: entry.slice(pivot + 1), confederation, currency: 'USD', domesticMode: 'background' as const }
  }).filter(item => !full.has(item.id)) : [])
