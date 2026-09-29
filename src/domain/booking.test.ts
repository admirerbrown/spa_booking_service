import { describe, expect, it } from 'vitest';
import { validateCustomerDetails } from './booking';

describe('validateCustomerDetails', () => {
  it('accepts a non-blank name and contact value', () => {
    expect(validateCustomerDetails({ name: 'Ama Mensah', contact: '+233 24 000 0000' })).toEqual({ valid: true });
  });

  it('reports both required fields without making a network request', () => {
    expect(validateCustomerDetails({ name: ' ', contact: '' })).toEqual({
      valid: false,
      errors: { name: 'Name is required.', contact: 'Contact is required.' },
    });
  });
});
