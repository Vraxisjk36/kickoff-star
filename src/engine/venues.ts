import type { Team } from './teams'
export interface YouthVenue { id:string; name:string; capacity:number; surface:'grass'|'hybrid'|'artificial'; city:string }
function hash(s:string){let h=0;for(const c of s)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return h}
export function venueForTeam(team:Team,country='Local'):YouthVenue{
 const h=hash(team.id+team.name)
 const suffix=team.name.replace(/\b(High|School|Secondary|Academy|FC|United|Town|City|Rovers|Athletic|Wanderers|Albion|County|Rangers)\b/g,'').trim()
 return{id:`ground-${team.id}`,name:`${suffix||team.short} Ground`,capacity:250+(h%2751),surface:h%5===0?'artificial':h%3===0?'hybrid':'grass',city:country}
}
