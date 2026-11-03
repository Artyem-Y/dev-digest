import { getTranslations } from 'next-intl/server';

import { getPull } from '../../../lib/api';

export default async function PullPage({ params }: { params: { id: string } }) {
  const [pull, t] = await Promise.all([
    getPull(params.id),
    getTranslations('pulls'),
  ]);

  return (
    <main>
      <h1>{pull.title}</h1>
      <section aria-labelledby="review-summary-heading">
        <h2 id="review-summary-heading">{t('reviewSummary')}</h2>
        {pull.reviewSummary === null ? (
          <p>{t('reviewSummaryUnavailable')}</p>
        ) : (
          <p>{pull.reviewSummary}</p>
        )}
      </section>
    </main>
  );
}
