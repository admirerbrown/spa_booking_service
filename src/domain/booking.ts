export type CustomerDetails = { name: string; contact: string };
export type CustomerDetailsValidation =
  | { valid: true }
  | { valid: false; errors: { name?: string; contact?: string } };

export function validateCustomerDetails({ name, contact }: CustomerDetails): CustomerDetailsValidation {
  const errors = {
    ...(name.trim() ? {} : { name: 'Name is required.' }),
    ...(contact.trim() ? {} : { contact: 'Contact is required.' }),
  };
  return Object.keys(errors).length === 0 ? { valid: true } : { valid: false, errors };
}
