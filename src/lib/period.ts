import type { PortfolioPeriod } from "../data/portfolio.ts";

export const formatPeriod = ({ start, end }: PortfolioPeriod): string =>
  `${start} — ${end ?? "Present"}`;
