export type TestRole="GLOBAL_INDEX"|"ACTIVE_EQUITY"|"TECHNOLOGY"|"EUROPE"|"EMERGING_MARKETS"|"FIXED_INCOME"|"FACTOR"|"ESG";
export interface Mvp1TestFund{name:string;isin:string;expectedManager:string;categoryHint:string;testRole:TestRole;}
export const MVP1_TEST_UNIVERSE:Mvp1TestFund[]=[
 {name:"Kron Indeks Global",isin:"NO0011101545",expectedManager:"Storebrand Asset Management",categoryHint:"Global indeks",testRole:"GLOBAL_INDEX"},
 {name:"Storebrand Global Indeks C",isin:"NO0012882036",expectedManager:"Storebrand Asset Management",categoryHint:"Global indeks",testRole:"GLOBAL_INDEX"},
 {name:"Storebrand Indeks – Alle Markeder A",isin:"NO0010611148",expectedManager:"Storebrand Asset Management",categoryHint:"Global indeks",testRole:"GLOBAL_INDEX"},
 {name:"KLP AksjeNorge Indeks N",isin:"NO0012445214",expectedManager:"KLP Kapitalforvaltning",categoryHint:"Norge",testRole:"GLOBAL_INDEX"},
 {name:"Storebrand Europe Index N",isin:"NO0013711242",expectedManager:"Storebrand Asset Management",categoryHint:"Europa",testRole:"EUROPE"},
 {name:"Storebrand Indeks – Nye Markeder N",isin:"NO0010817919",expectedManager:"Storebrand Asset Management",categoryHint:"Fremvoksende markeder",testRole:"EMERGING_MARKETS"},
 {name:"DNB Teknologi B",isin:"NO0013004622",expectedManager:"DNB Asset Management",categoryHint:"Teknologi",testRole:"TECHNOLOGY"},
 {name:"Storebrand Global Multifactor N",isin:"NO0010817505",expectedManager:"Storebrand Asset Management",categoryHint:"Global faktor",testRole:"FACTOR"},
 {name:"Storebrand Verdi N",isin:"NO0010817836",expectedManager:"Storebrand Asset Management",categoryHint:"Norge verdi",testRole:"ACTIVE_EQUITY"},
 {name:"Storebrand Vekst B",isin:"NO0012884149",expectedManager:"Storebrand Asset Management",categoryHint:"Norge vekst",testRole:"ACTIVE_EQUITY"},
 {name:"Fidelity Funds – World Fund A-Euro",isin:"LU0069449576",expectedManager:"Fidelity International",categoryHint:"Global aksje",testRole:"ACTIVE_EQUITY"},
 {name:"Fidelity Nordic A-Acc-SEK",isin:"LU0261949381",expectedManager:"Fidelity International",categoryHint:"Norden",testRole:"ACTIVE_EQUITY"},
 {name:"Fidelity Europe Equity ESG A-Acc-EUR",isin:"LU0251128657",expectedManager:"Fidelity International",categoryHint:"Europa ESG",testRole:"ESG"},
 {name:"JPM US Select Equity A (acc) USD",isin:"LU0070214290",expectedManager:"J.P. Morgan Asset Management",categoryHint:"USA",testRole:"ACTIVE_EQUITY"},
 {name:"JPM Emerging Markets Sustainable Equity A (acc) USD",isin:"LU2051468812",expectedManager:"J.P. Morgan Asset Management",categoryHint:"Fremvoksende markeder ESG",testRole:"ESG"},
 {name:"Storebrand Likviditet N",isin:"NO0010818008",expectedManager:"Storebrand Asset Management",categoryHint:"Likviditet",testRole:"FIXED_INCOME"},
 {name:"Storebrand Kreditt N",isin:"NO0010818057",expectedManager:"Storebrand Asset Management",categoryHint:"Kreditt",testRole:"FIXED_INCOME"},
 {name:"Storebrand Global Kreditt IG B",isin:"NO0010588031",expectedManager:"Storebrand Asset Management",categoryHint:"Global kreditt",testRole:"FIXED_INCOME"},
 {name:"Alfred Berg Likviditet R (NOK)",isin:"NO0010089485",expectedManager:"Alfred Berg Kapitalforvaltning",categoryHint:"Likviditet",testRole:"FIXED_INCOME"},
 {name:"FORTE Strategisk A",isin:"NO0010963432",expectedManager:"Forte Fondsforvaltning",categoryHint:"Kombinasjon",testRole:"ACTIVE_EQUITY"},
];
