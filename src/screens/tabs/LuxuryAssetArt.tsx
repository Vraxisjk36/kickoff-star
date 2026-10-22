import type { LuxuryKind } from '../../engine/proLifestyle'

/** Lightweight, offline-safe SVG showroom art. Deterministic palette and details give
 * each listing its own illustration without downloading 150 large photos. */
export default function LuxuryAssetArt({kind,id,large=false}:{kind:LuxuryKind;id:string;large?:boolean}){
 const n=Number(id.split('-').at(-1))||1
 const accent=['#d4af37','#b7a37a','#c6c8ca','#9bafbc','#bb9770'][n%5]
 const shade=['#101e29','#172029','#211c25','#152322','#241c1a'][n%5]
 const common={stroke:accent,strokeWidth:2.6,strokeLinejoin:'round' as const,strokeLinecap:'round' as const}
 return <svg role="img" aria-label={`Illustration of ${kind} listing ${n}`} viewBox="0 0 400 215" preserveAspectRatio="xMidYMid slice" className={`w-full ${large?'h-52':'h-32'} rounded-lg`}>
   <defs>
     <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={shade}/><stop offset="1" stopColor="#080a0c"/></linearGradient>
     <linearGradient id={`shine-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={accent} stopOpacity=".55"/><stop offset="1" stopColor={accent} stopOpacity=".08"/></linearGradient>
   </defs>
   <rect width="400" height="215" fill={`url(#bg-${id})`}/>
   <circle cx="320" cy="34" r="105" fill={accent} opacity=".045"/>
   <path d="M0 177H400 M0 192H400" stroke={accent} opacity=".16"/>
   {kind==='house'&&<g {...common}>
     <path d={n%3===0?'M62 118L196 35 339 118':'M62 111L200 48 338 111'} fill="none"/>
     <path d="M88 105V178H314V105" fill={`url(#shine-${id})`}/>
     <path d="M176 178V120H226V178" fill="#0c1319"/>
     {Array.from({length:4},(_,i)=><rect key={i} x={105+(i%2)*148} y={115+Math.floor(i/2)*32} width="38" height="22" fill="#111d25" stroke={accent} opacity=".85"/>)}
     <path d="M42 178H355M65 179L37 195M333 179L361 195" opacity=".5"/>
     {n%2===0&&<path d="M315 98V56H345V119" fill="#111d25"/>}
   </g>}
   {kind==='car'&&<g {...common}>
     <ellipse cx="200" cy="180" rx="148" ry="11" fill="#000" opacity=".45" stroke="none"/>
     <path d={n%3===0?'M54 145L86 109Q123 86 184 83H250Q288 86 319 130L350 141V165H50V150Z':'M48 144L87 126L128 92Q153 80 236 85L286 124L347 141V167H49Z'} fill={`url(#shine-${id})`}/>
     <path d="M119 125L145 96H235L269 125Z" fill="#101c27"/>
     <path d="M184 96L178 125M64 143H100M305 143H343" fill="none"/>
     <circle cx="118" cy="168" r="24" fill="#080a0d"/><circle cx="118" cy="168" r="11" fill="#27313a"/>
     <circle cx="288" cy="168" r="24" fill="#080a0d"/><circle cx="288" cy="168" r="11" fill="#27313a"/>
   </g>}
   {kind==='plane'&&<g {...common}>
     <path d="M29 126L173 111L243 42Q252 34 262 41L240 108L344 119Q362 122 369 131L236 140L210 180L191 182L201 140L100 140L72 155L57 153L73 132Z" fill={`url(#shine-${id})`}/>
     <path d="M175 115L234 114M205 138L235 138M304 121L338 127" opacity=".7"/>
     <circle cx="267" cy="121" r="4" fill={accent} stroke="none"/>
   </g>}
   {kind==='boat'&&<g {...common}>
     <path d="M48 146H352L318 182H90Z" fill={`url(#shine-${id})`}/>
     <path d="M121 144V106H272L311 144Z" fill="#17232b"/>
     <path d="M154 105V79H248L270 105Z" fill="#1b2932"/>
     <path d="M191 79V49M191 50L225 65H191" fill="none"/>
     {Array.from({length:5},(_,i)=><rect key={i} x={144+i*31} y="116" width="19" height="12" rx="3" fill="#0a1017"/>)}
     <path d="M12 192Q37 181 62 192T112 192T162 192T212 192T262 192T312 192T362 192" fill="none" opacity=".5"/>
   </g>}
   <text x="20" y="26" fill={accent} opacity=".75" fontSize="10" fontFamily="sans-serif" letterSpacing="3">{kind.toUpperCase()} COLLECTION · {String(n).padStart(3,'0')}</text>
 </svg>
}
