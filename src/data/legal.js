// Company and legal data used by /aszf, /adatkezeles and /impresszum.
// LEGAL_DRAFT = true shows a "draft" banner on the three pages (final since 2026-11-16).
export const LEGAL_DRAFT = false;
export const LEGAL_UPDATED = '2026. november 25.';

// Seller and data controller: the hotel's operating company.
// Source: hotel imprint + Nemzeti Cégtár (provided by the user, 2026-11-13).
export const SELLER = {
  name: 'IROTTKŐ HOTEL Szálláshely Értékesítő Korlátolt Felelősségű Társaság',
  shortName: 'IROTTKŐ HOTEL Kft.',
  seat: '9730 Kőszeg, Fő tér 4.',
  regNo: '18-09-102193',
  registry: 'Szombathelyi Törvényszék Cégbírósága',
  taxNo: '11312037-2-18',
  ntak: 'SZ19000069',
  email: 'info@irottko.hu',
  phone: '+36 94 360 373',
  web: 'https://www.irottko.hu',
};

// Platform operator / developer (data processor).
export const OPERATOR = {
  name: 'Avar Szilveszter (SA Software and Network Solutions)',
  form: 'adószámos magánszemély',
  seat: '9730 Kőszeg, Mélyút utca 10.',
  taxNo: '91848521-1-38',
  email: 'avar.szilveszter@gmail.com',
  phone: '+36 70 636 4745',
};

// Hosting provider (required in the imprint by Ektv. 4. §).
// Source: netlify.com/privacy and netlify.com/legal/terms-of-use (checked 2026-11-13).
export const HOSTING = {
  name: 'Netlify, Inc.',
  address: '101 2nd Street, San Francisco, CA 94105, USA',
  web: 'https://www.netlify.com',
  email: 'support@netlify.com',
};

// Where order data is stored (Supabase project region).
export const DB_REGION = 'EU, Írország';

// How long ticket / order data is kept after the event (invoices: 8 years, at the seller).
export const RETENTION_DAYS_AFTER_EVENT = 90;
