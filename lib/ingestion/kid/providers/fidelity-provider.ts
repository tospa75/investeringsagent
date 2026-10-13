import type{KidCandidate,KidFundIdentity,KidProvider}from"../kid-types";
const FIDELITY_ISINS=new Set(["LU0069449576","LU0261949381","LU0251128657"]);
export class FidelityKidProvider implements KidProvider{name="Fidelity";canHandle(fund:KidFundIdentity){return FIDELITY_ISINS.has(fund.isin);}async discover(fund:KidFundIdentity):Promise<KidCandidate>{return{url:`https://fidelity.priips-document.com/Fidelity-International/${encodeURIComponent(fund.isin)}/en/eu/`,documentType:"PRIIP_KID",discoveryMethod:"MANAGER_PAGE",providerName:this.name,authoritative:true};}}
