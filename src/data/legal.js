// Company and legal data used by /aszf, /adatkezeles and /impresszum.
// Fill in the [ ] fields from the hotel's company documents, have a lawyer review
// the three pages, then set LEGAL_DRAFT = false (removes the "draft" banner).
export const LEGAL_DRAFT = true;
export const LEGAL_UPDATED = '2026. november 13.';

// Seller and data controller: the hotel's operating company.
export const SELLER = {
  name: '[Hotel üzemeltető cég neve]',
  seat: '[Székhely: irányítószám, település, utca, házszám]',
  regNo: '[Cégjegyzékszám]',
  registry: '[Nyilvántartó cégbíróság]',
  taxNo: '[Adószám]',
  email: '[ügyfélszolgálati e-mail]',
  phone: '[telefonszám]',
  representative: '[Képviselő neve]',
};

// Platform operator / developer (data processor).
export const OPERATOR = {
  name: 'SA Software and Network Solutions',
  seat: '[Székhely]',
  taxNo: '[Adószám]',
  email: '[e-mail]',
};

// Hosting provider (required in the imprint by Ektv. 4. §).
// VERIFY the address on netlify.com before go-live (written from memory).
export const HOSTING = {
  name: 'Netlify, Inc.',
  address: '512 2nd Street, Suite 200, San Francisco, CA 94107, USA',
  web: 'https://www.netlify.com',
  email: 'support@netlify.com',
};

// Where order data is stored (Supabase project region – check in the Supabase dashboard).
export const DB_REGION = '[Supabase projekt régiója, pl. EU (Frankfurt)]';

// How long ticket / order data is kept after the event (invoices: 8 years, at the seller).
export const RETENTION_DAYS_AFTER_EVENT = 90;
