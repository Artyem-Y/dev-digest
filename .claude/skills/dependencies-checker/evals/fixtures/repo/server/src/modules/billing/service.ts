import { saveInvoice } from './repository';
import { summarizeInvoice } from './summary';

export const createInvoice = () => summarizeInvoice(saveInvoice());
