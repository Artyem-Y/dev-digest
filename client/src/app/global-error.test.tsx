import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';

describe('GlobalError', () => {
  it('offers a user-visible retry after a root rendering failure', async () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('unexpected')} reset={reset} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
