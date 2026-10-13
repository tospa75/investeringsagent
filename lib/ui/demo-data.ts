export const demoPositions = [
  { id: "kron-global", name: "Kron Indeks Global", value: 13510, actual: .5746, target: .30, costBasis: 12622, gain: 887, returnPct: .0703, status: "FRESH" as const },
  { id: "storebrand-global", name: "Storebrand Global Indeks C", value: 10000, actual: .4254, target: .30, costBasis: 10510, gain: -510, returnPct: -.0485, status: "FRESH" as const },
];
export const exposure = {
  regions: [["Nord-Amerika", .758], ["Europa", .152], ["Utviklet Asia", .086], ["Øvrige", .004]],
  sectors: [["Teknologi", .327], ["Finans", .157], ["Industri", .099], ["Helse", .093], ["Øvrige", .324]],
  assets: [["Aksjer", .998], ["Kontanter", .002]],
  holdings: [["NVIDIA", .052], ["Apple", .047], ["Microsoft", .041], ["Amazon", .026]],
};
export const scoreFunds = [
  { id: "kron-global", name: "Kron Indeks Global", category: "Globale aksjer", score: 88, confidence: "Høy", risk: 86, cost: 94, geography: 76, sector: 82, diversification: 91, performance: 79, quality: 89, status: "PASS" },
  { id: "storebrand-global", name: "Storebrand Global Indeks C", category: "Globale aksjer", score: 85, confidence: "Høy", risk: 84, cost: 91, geography: 74, sector: 80, diversification: 89, performance: 77, quality: 87, status: "PASS" },
  { id: "emerging", name: "Storebrand Indeks – Nye Markeder N", category: "Nye markeder", score: 76, confidence: "Middels", risk: 68, cost: 83, geography: 91, sector: 71, diversification: 78, performance: 65, quality: 75, status: "PASS" },
];
export const monitoringAlerts = [
  { severity: "WARNING" as const, title: "Høy fondsvekt", message: "Kron Indeks Global er 27,46 prosentpoeng over målvekten.", fund: "Kron Indeks Global", date: "12.10.2026", action: "Vurder rebalansering" },
  { severity: "INFO" as const, title: "Nye NAV-data", message: "Verdiene er oppdatert med siste tilgjengelige NAV.", fund: null, date: "12.10.2026", action: "Ingen handling nødvendig" },
];
