import React from "react";

// [ISO2, ISO3, nombre]
const RAW = [
["es","ESP","España"],["ad","AND","Andorra"],["ar","ARG","Argentina"],["am","ARM","Armenia"],["au","AUS","Australia"],["at","AUT","Austria"],["az","AZE","Azerbaiyán"],
["be","BEL","Bélgica"],["by","BLR","Bielorrusia"],["bo","BOL","Bolivia"],["ba","BIH","Bosnia y Herzegovina"],["br","BRA","Brasil"],["bg","BGR","Bulgaria"],
["cm","CMR","Camerún"],["ca","CAN","Canadá"],["cl","CHL","Chile"],["cn","CHN","China"],["co","COL","Colombia"],["kr","KOR","Corea del Sur"],["ci","CIV","Costa de Marfil"],
["cr","CRI","Costa Rica"],["hr","HRV","Croacia"],["cu","CUB","Cuba"],["dk","DNK","Dinamarca"],["ec","ECU","Ecuador"],["eg","EGY","Egipto"],["sv","SLV","El Salvador"],
["ae","ARE","Emiratos Árabes"],["sk","SVK","Eslovaquia"],["si","SVN","Eslovenia"],["us","USA","Estados Unidos"],["ee","EST","Estonia"],["ph","PHL","Filipinas"],
["fi","FIN","Finlandia"],["fr","FRA","Francia"],["ga","GAB","Gabón"],["gm","GMB","Gambia"],["ge","GEO","Georgia"],["gh","GHA","Ghana"],["gr","GRC","Grecia"],
["gq","GNQ","Guinea Ecuatorial"],["gn","GIN","Guinea"],["gw","GNB","Guinea-Bisáu"],["ht","HTI","Haití"],["nl","NLD","Países Bajos"],["hn","HND","Honduras"],
["hu","HUN","Hungría"],["in","IND","India"],["id","IDN","Indonesia"],["ie","IRL","Irlanda"],["is","ISL","Islandia"],["il","ISR","Israel"],["it","ITA","Italia"],
["jm","JAM","Jamaica"],["jp","JPN","Japón"],["kz","KAZ","Kazajistán"],["ke","KEN","Kenia"],["xk","XKX","Kosovo"],["lv","LVA","Letonia"],["lb","LBN","Líbano"],
["lr","LBR","Liberia"],["ly","LBY","Libia"],["lt","LTU","Lituania"],["lu","LUX","Luxemburgo"],["mk","MKD","Macedonia del Norte"],["ml","MLI","Malí"],["ma","MAR","Marruecos"],
["mx","MEX","México"],["md","MDA","Moldavia"],["me","MNE","Montenegro"],["mz","MOZ","Mozambique"],["ni","NIC","Nicaragua"],["ne","NER","Níger"],["ng","NGA","Nigeria"],
["no","NOR","Noruega"],["nz","NZL","Nueva Zelanda"],["pk","PAK","Pakistán"],["pa","PAN","Panamá"],["py","PRY","Paraguay"],["pe","PER","Perú"],["pl","POL","Polonia"],
["pt","PRT","Portugal"],["gb","GBR","Reino Unido"],["cz","CZE","Chequia"],["cd","COD","RD Congo"],["cg","COG","Congo"],["do","DOM","República Dominicana"],["ro","ROU","Rumanía"],
["ru","RUS","Rusia"],["sn","SEN","Senegal"],["rs","SRB","Serbia"],["sl","SLE","Sierra Leona"],["sy","SYR","Siria"],["za","ZAF","Sudáfrica"],["se","SWE","Suecia"],
["ch","CHE","Suiza"],["tg","TGO","Togo"],["tn","TUN","Túnez"],["tr","TUR","Turquía"],["ua","UKR","Ucrania"],["uy","URY","Uruguay"],["ve","VEN","Venezuela"],["dz","DZA","Argelia"],
["ao","AGO","Angola"],["cv","CPV","Cabo Verde"],["sa","SAU","Arabia Saudí"],["ir","IRN","Irán"],["iq","IRQ","Irak"],["uz","UZB","Uzbekistán"],["al","ALB","Albania"],["cy","CYP","Chipre"],["mt","MLT","Malta"],
];

// Comunidades autónomas (código ISO 3166-2 sin "ES-")
export const REGIONS = [
  ["an","Andalucía"],["ar","Aragón"],["as","Asturias"],["ib","Islas Baleares"],["cn","Canarias"],["cb","Cantabria"],["cl","Castilla y León"],["cm","Castilla-La Mancha"],
  ["ct","Cataluña"],["ce","Ceuta"],["vc","Comunidad Valenciana"],["ex","Extremadura"],["ga","Galicia"],["md","Madrid"],["ml","Melilla"],["mc","Murcia"],["nc","Navarra"],
  ["pv","País Vasco"],["ri","La Rioja"],
].map(([code, name]) => ({ code, name }));
const REGION_FILE = {
  an: "Flag_of_Andalusia.svg", ar: "Flag_of_Aragon.svg", as: "Flag_of_Asturias.svg", ib: "Flag_of_the_Balearic_Islands.svg", cn: "Flag_of_the_Canary_Islands.svg",
  cb: "Flag_of_Cantabria.svg", cl: "Flag_of_Castile_and_León.svg", cm: "Flag_of_Castilla-La_Mancha.svg", ct: "Flag_of_Catalonia.svg", ce: "Flag_of_Ceuta.svg",
  vc: "Flag_of_the_Land_of_Valencia_(official).svg", ex: "Flag_of_Extremadura_(with_coat_of_arms).svg", ga: "Flag_of_Galicia.svg", md: "Flag_of_the_Community_of_Madrid.svg",
  ml: "Flag_of_Melilla.svg", mc: "Flag_of_the_Region_of_Murcia.svg", nc: "Flag_of_Navarre.svg", pv: "Flag_of_the_Basque_Country.svg", ri: "Flag_of_La_Rioja_(with_coat_of_arms).svg",
};
const regionSrc = (code, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(REGION_FILE[code])}?width=${w}`;
export const regionOf = (p) => (p?.region ? REGIONS.find((r) => r.code === p.region) || null : null);

export const COUNTRIES = RAW.map(([a2, a3, name]) => ({ a2, a3, name }));
const strip = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const BY_KEY = new Map();
COUNTRIES.forEach((c) => { BY_KEY.set(strip(c.a3), c); BY_KEY.set(strip(c.a2), c); BY_KEY.set(strip(c.name), c); });

// Acepta código ISO3 ("HUN") o texto antiguo ("Hungría").
export const countryOf = (p) => BY_KEY.get(strip(p?.nationality)) || null;
export const isForeign = (p) => { const c = countryOf(p); return !!c && c.a3 !== "ESP"; };

export function Flag({ player, code, showCode = true, className = "" }) {
  const c = code ? BY_KEY.get(strip(code)) : countryOf(player);
  if (!c) return null;
  const region = player ? regionOf(player) : null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={c.name}>
      <img src={`https://flagcdn.com/w20/${c.a2}.png`} srcSet={`https://flagcdn.com/w40/${c.a2}.png 2x`} width="16" height="12" alt={c.name} loading="lazy" className="inline-block rounded-[2px] border border-black/10 object-cover" style={{ width: 16, height: 12 }} />
      {showCode && <span className="text-[10px] font-bold text-gray-500 tracking-wide">{c.a3}</span>}
      {c.a3 === "ESP" && region && (
        <span title={region.name} className="inline-flex"><img src={regionSrc(region.code, 20)} srcSet={`${regionSrc(region.code, 40)} 2x`} alt={region.name} loading="lazy" className="inline-block rounded-[2px] border border-black/10 object-cover" style={{ width: 16, height: 12 }} /></span>
      )}
    </span>
  );
}
