import { createInvoice } from './service';

export const summarizeInvoice = (invoice) => ({ ...invoice, retry: createInvoice });
