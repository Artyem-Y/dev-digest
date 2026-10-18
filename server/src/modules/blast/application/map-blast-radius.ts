import type { BlastRadius } from '@devdigest/shared';
import type { BlastResult } from '../../repo-intel/types.js';

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function mapBlastResult(result: BlastResult): BlastRadius {
  const downstream = result.changedSymbols.map((changed) => {
    const callers = result.callers
      .filter((caller) => caller.viaSymbol === changed.name)
      .map((caller) => ({ name: caller.symbol, file: caller.file, line: caller.line }));
    const callerFiles = new Set(callers.map((caller) => caller.file));
    const endpoints = new Set<string>();
    const crons = new Set<string>();
    for (const file of callerFiles) {
      const facts = result.factsByFile?.[file];
      for (const endpoint of facts?.endpoints ?? []) endpoints.add(endpoint);
      for (const cron of facts?.crons ?? []) crons.add(cron);
    }
    return {
      symbol: changed.name,
      callers,
      endpoints_affected: [...endpoints],
      crons_affected: [...crons],
    };
  });
  const callerCount = downstream.reduce((total, item) => total + item.callers.length, 0);
  const endpointCount = new Set(downstream.flatMap((item) => item.endpoints_affected)).size;
  const cronCount = new Set(downstream.flatMap((item) => item.crons_affected)).size;

  return {
    changed_symbols: result.changedSymbols.map(({ name, file, kind }) => ({ name, file, kind })),
    downstream,
    summary: [
      plural(result.changedSymbols.length, 'symbol'),
      plural(callerCount, 'caller'),
      plural(endpointCount, 'endpoint'),
      plural(cronCount, 'cron/job', 'cron/jobs'),
    ].join(' · '),
    degraded: result.degraded === true,
    reason: result.reason ?? null,
  };
}
