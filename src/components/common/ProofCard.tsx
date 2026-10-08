import type { PresentedClaim } from "@/lib/proof";
import { SourceStamp } from "./SourceStamp";

/**
 * One public claim, with its provenance attached.
 *
 * A lapsed claim renders here too, deliberately. Dropping it would make the
 * verified block quietly shorter and nobody would learn that verification
 * lapsed; keeping it in place, visibly marked and out of the "verified"
 * framing, is the honest version. See src/lib/proof.ts.
 */
export function ProofCard({
  presented,
  locale,
}: {
  presented: PresentedClaim;
  locale: "tr" | "en";
}) {
  const { claim } = presented;
  const lapsed = presented.kind === "lapsed";
  const statement = locale === "tr" ? claim.statementTr : claim.statementEn;

  return (
    <li
      className="glass p-6 h-full"
      style={lapsed ? { borderColor: "rgba(251,191,36,0.28)" } : undefined}
    >
      <p
        className={`text-[15px] leading-[1.7] ${lapsed ? "text-ink-300" : "text-ink-100"}`}
      >
        {statement}
      </p>
      <SourceStamp
        evidenceKind={claim.evidenceKind}
        verifiedAt={claim.verifiedAt}
        source={claim.source}
        scope={locale === "tr" ? claim.scopeTr : claim.scopeEn}
        locale={locale}
        expiredOn={lapsed ? presented.expiredOn : undefined}
      />
    </li>
  );
}
