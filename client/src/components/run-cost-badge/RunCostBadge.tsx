import React from "react";

export function formatRunCostUsd(costUsd: number | null | undefined): string {
  if (costUsd == null) return "—";
  if (costUsd === 0) return "$0.00";
  if (costUsd < 0.0001) return "<$0.0001";
  const roundedToFourDecimals = Number(costUsd.toFixed(4));
  if (roundedToFourDecimals >= 1) return `$${roundedToFourDecimals.toFixed(2)}`;
  return `$${costUsd.toFixed(4).replace(/0+$/, "")}`;
}

function formatTotalTokens(tokensIn: number | null | undefined, tokensOut: number | null | undefined): string {
  if (tokensIn == null || tokensOut == null) return "—";
  return `${(tokensIn + tokensOut).toLocaleString("en-US")} tok`;
}

export function RunCostBadge({
  costUsd,
  variant = "compact",
  tokensIn,
  tokensOut,
}: {
  costUsd: number | null | undefined;
  variant?: "compact" | "timeline";
  tokensIn?: number | null;
  tokensOut?: number | null;
}) {
  const cost = formatRunCostUsd(costUsd);
  const value = variant === "timeline" ? `${formatTotalTokens(tokensIn, tokensOut)} · ${cost}` : cost;
  return (
    <span className="mono" title="Run cost in USD" style={{ whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}
