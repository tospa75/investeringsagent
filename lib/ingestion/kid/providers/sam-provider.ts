import type { KidCandidate, KidFundIdentity, KidProvider } from "../kid-types";

export class SamRepositoryProvider implements KidProvider {
  name = "SAM PRIIP Repository";
  canHandle(_fund: KidFundIdentity) { return true; }
  async discover(fund: KidFundIdentity): Promise<KidCandidate> {
    return {
      url: `https://sam.repository.systems/priip/latest/priip_${encodeURIComponent(fund.isin)}_NOK_nb_NO.pdf`,
      documentType: "PRIIP_KID", discoveryMethod: "PUBLIC_DISTRIBUTOR", providerName: this.name, authoritative: false,
    };
  }
}
