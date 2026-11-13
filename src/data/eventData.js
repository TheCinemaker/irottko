export const EVENT_DETAILS = {
  title: "ONE NIGHT AT ÍROTTKŐ",
  tagline: "4 FELLÉPŐ • 3 BÁR • VIP LOUNGE",
  dateString: "2027. január 15. (Péntek)",
  isoDate: "2027-01-15T19:00:00+01:00",
  doorsOpen: "19:00",
  venue: "Hotel Írottkő, Kőszeg",
  address: "9730 Kőszeg, Fő tér 4.",
  description: "A patinás kőszegi Hotel Írottkő aulája kizárólag egyetlen éjszakára alakul át luxus klubtérré. Három bár, VIP Lounge és négy fellépő, 19:00-tól hajnalig.",
};

// Line-up (from the organiser, 2026-11-13). Only names and times – no invented bios.
// headliner: true → big gold type.
export const DJS = [
  { id: "saffron", name: "SAFFRON", time: "19:00 – 22:00" },
  { id: "dj-barany", name: "DJ Bárány Attila", time: "22:00 – 23:30", headliner: true },
  { id: "frombob", name: "fromBOB", time: "23:30 – 01:00" },
  { id: "tisztafaxxa", name: "TISZTAFAXXA Classics", time: "01:00-tól" },
];

// Bars and their operators (from the organiser, 2026-11-13).
// Menus: ONLY items the operator has confirmed. Empty list → "Az itallap hamarosan".
// operator: shown on the tile and the bar page.
export const BARS_DATA = [
  {
    id: "spirit-bar",
    slug: "koktel",
    name: "Koktélbár",
    operator: "Hotel Írottkő",
    location: null,
    shortDesc: "Koktélok és röviditalok – a Hotel Írottkő bárja.",
    items: [
      { name: "Bacardí rum (4cl)", price: "2 200 Ft", badge: "Santiago de Cuba · 1862" },
    ],
  },
  {
    id: "wine-bar",
    slug: "bor",
    name: "Borbár",
    operator: "Jagodics Pince, Kőszeg",
    location: null,
    shortDesc: "A kőszegi Jagodics Pince borai.",
    items: [],
  },
  {
    id: "beer-bar",
    slug: "sor",
    name: "Sörbár",
    operator: "Kőszegi Sör, Kőszeg",
    location: null,
    shortDesc: "A Kőszegi Sör sörei.",
    items: [],
  },
  {
    id: "vip-bar",
    slug: "vip",
    name: "VIP Pezsgőbár & Lounge",
    operator: null,
    location: null,
    shortDesc: "Pezsgők és palackos italok a VIP vendégeknek.",
    items: [],
  },
];

// Kitchen (not a bar). Menu still being planned – no dishes listed until confirmed.
export const KITCHEN = {
  name: "Fedélzeti menü",
  shortDesc: "Falatok a 90-es évek diszkóiból: melegszendvics és apró falatkák.",
  note: "A menüt hamarosan közzétesszük.",
};

// Practical info shown on the home page.
export const INFO = [
  { label: "Gate open", value: "2027. január 15., péntek, 19:00" },
  { label: "Terminál", value: "Hotel Írottkő, Kőszeg, Fő tér 4." },
  { label: "DJ-pult", value: "Első emelet, karzat" },
  {
    label: "Dress code",
    value: "Hozd a 90-es, 2000-es évek hangulatát! Kockás ing, farmer, terepnadrág – minél „akkoribb\", annál jobb.",
  },
  { label: "Beszállás", value: "Névre szóló beszállókártyával, 18 éven felülieknek. Fényképes igazolványt hozz magaddal." },
];

// Ticket prices and sales windows live in the database (supabase/seed_2027.sql);
// the site reads them live (src/lib/usePricing.js). Only the descriptions are here.
export const TICKET_PERKS = {
  standard: [
    "Belépés az est teljes idejére",
    "Mindhárom bár és a tánctér",
    "Mind a négy fellépő",
    "Digitális jegy Apple és Google Wallethez",
  ],
  vip: [
    "Minden, ami a normál jegyben",
    "VIP Lounge saját pulttal",
    "Soron kívüli belépés",
    "Welcome drink érkezéskor",
  ],
};
