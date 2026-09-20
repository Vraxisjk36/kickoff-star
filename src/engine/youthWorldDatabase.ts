import { NATIONS } from './nations'
export interface WorldSchool { id:string; name:string; countryId:string; regionId:string; districtId:string; rating:number }
export interface WorldDistrict { id:string; name:string; schools:WorldSchool[] }
export interface WorldRegion { id:string; name:string; districts:WorldDistrict[] }
export interface CountryYouthWorld { countryId:string; countryName:string; regions:WorldRegion[] }
const REGION_NAMES=['Central','North','South','East','West','Coastal','Highlands','Metro']
const DISTRICT_NAMES=['Premier District','City District','County District','Development District','Schools District','Community District','Academy District','Regional District']
const SCHOOL_ROOTS=['Kings','Queens','Riverside','Hillcrest','Westview','Greenwood','Northfield','Southdale','Eastgate','Oakridge']
function slug(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function hash(s:string){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function buildCountryYouthWorld(countryId:string):CountryYouthWorld{
 const nation=NATIONS.find(n=>n.id===countryId)??NATIONS[0]
 const regions=REGION_NAMES.map((rn,ri)=>{const regionId=`${countryId}-r${ri+1}`;const districts=DISTRICT_NAMES.map((dn,di)=>{const districtId=`${regionId}-d${di+1}`;const schools=Array.from({length:10},(_,si)=>{const root=SCHOOL_ROOTS[(si+di+ri)%SCHOOL_ROOTS.length];const name=`${root} ${rn} ${di+1} School`;return{id:`${districtId}-s${si+1}-${slug(root)}`,name,countryId,regionId,districtId,rating:36+(hash(name)%23)}});return{id:districtId,name:`${rn} ${dn}`,schools}});return{id:regionId,name:`${nation.name} ${rn}`,districts}})}
 return{countryId:nation.id,countryName:nation.name,regions}
}
export function countrySchools(countryId:string){return buildCountryYouthWorld(countryId).regions.flatMap(r=>r.districts.flatMap(d=>d.schools))}
export function localSchoolChoices(countryId:string){const w=buildCountryYouthWorld(countryId);return w.regions[0].districts[0].schools}
export function worldSchool(id:string,countryId:string){return countrySchools(countryId).find(s=>s.id===id)}
export function worldCounts(countryId:string){const w=buildCountryYouthWorld(countryId);return{regions:w.regions.length,districts:w.regions.reduce((n,r)=>n+r.districts.length,0),schools:countrySchools(countryId).length}}
