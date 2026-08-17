import { config } from './config.js';
import type { RepoRow } from './db/repositories.js';

/** Circuit-breaker gate: refuse LLM work once the repo's monthly spend hits the cap. */
export function checkRepoSpendCap(repo: RepoRow): void {
  const spent = parseFloat(repo.llm_spend_usd);
  if (spent >= config.llm.repoMonthlyCapUsd) {
    throw new SpendCapError(
      `repo ${repo.full_name} hit its monthly LLM cap ($${spent.toFixed(2)} >= $${config.llm.repoMonthlyCapUsd}); fix generation halted`,
    );
  }
}

export class SpendCapError extends Error {}
