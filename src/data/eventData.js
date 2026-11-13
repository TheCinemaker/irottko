export const EVENT_DETAILS = {
  title: "ONE NIGHT AT ÍROTTKŐ",
  tagline: "3 DJ • 3 BÁR • VIP LOUNGE",
  dateString: "2027. január 15. (Péntek)",
  isoDate: "2027-01-15T19:00:00+01:00",
  doorsOpen: "19:00",
  venue: "Hotel Írottkő, Kőszeg",
  address: "9730 Kőszeg, Fő tér 4.",
  description: "A patinás kőszegi Hotel Írottkő aulája kizárólag egyetlen éjszakára alakul át luxus klubtérré. Prémium italok, 3 bárpult, VIP galéria és Magyarország legikonikusabb DJ-je a lemezjátszók mögött!",
};

export const DJS = [
  {
    id: "szombathelyi-dj",
    name: "Szombathelyi DJ",
    role: "WARM-UP & CLUB HITS",
    genre: "Deep House / Vocal House",
    time: "20:00 - 22:30",
    description: "A vasi éjszakák rezidense hozza meg a lendületet és emeli a party hőfokát a nyitást követően.",
    color: "#a855f7"
  },
  {
    id: "barany-attila",
    name: "DJ BÁRÁNY ATTILA",
    role: "HEADLINER • SZTÁRVENDÉG",
    genre: "Club Classics / Peak Time House",
    time: "22:30 - 01:30",
    badge: "EXKLUZÍV KŐSZEGI FELLÉPÉS",
    description: "A hazai klubélet vitathatatlan legendája, a Disco's Hit motorja, aki felrobbantja az Írottkő táncterét!",
    color: "#d4af37"
  },
  {
    id: "dj-young",
    name: "DJ Young",
    role: "CLOSING & AFTER",
    genre: "Tech-House / EDM Anthem",
    time: "01:30 - 04:00",
    description: "Modern ütemek és kőkemény groove-ok hajnalig, amíg az utolsó koktél is el nem fogy.",
    color: "#ec4899"
  }
];

export const BARS_DATA = [
  {
    id: "beer-bar",
    slug: "sor",
    name: "Sörbár",
    icon: "🍺",
    location: "Bal szárny (A lounge terasz mellett)",
    shortDesc: "Csapolt kézműves különlegességek és hűtött prémium üveges sörök.",
    accent: "from-amber-600/30 to-amber-900/10",
    borderColor: "border-amber-500/30",
    items: [
      { name: "Pilsner Urquell Csapolt (0.5l)", price: "890 Ft", badge: "Csapolt" },
      { name: "Paulaner Hefe-Weißbier búzasör", price: "990 Ft", badge: "Bajor klasszikus" },
      { name: "Kőszegi Kézműves IPA (0.33l)", price: "1 150 Ft", badge: "Helyi kedvenc" },
      { name: "Guinness Extra Stout (0.33l)", price: "1 250 Ft", badge: "Prémium" },
      { name: "Mort Subite Kriek Meggysör", price: "1 090 Ft", badge: "Népszerű" }
    ]
  },
  {
    id: "wine-bar",
    slug: "bor",
    name: "Borbár",
    icon: "🍷",
    location: "Jobb szárny (A kandalló mellett)",
    shortDesc: "Kőszegi, soproni és tokaji tételek, hűsítő fröccsök.",
    accent: "from-rose-600/30 to-purple-900/10",
    borderColor: "border-rose-500/30",
    items: [
      // TODO: price + serving (pl. "… Ft/dl") from the client — hidden on the menu until set
      { name: "Tokaji Aszú", price: null, badge: "Tokaji borvidék" },
      { name: "Alasz Pince Kékfrankos Válogatás", price: "690 Ft/dl", badge: "Kőszegi Dűlő" },
      { name: "Stefanich Pincészet Kőszegi Olaszrizling", price: "590 Ft/dl", badge: "Fröccs kedvenc" },
      { name: "Soproni Zweigelt Rosé Barrique", price: "650 Ft/dl", badge: "Gyümölcsös friss" },
      { name: "Nagy és Nagy Sauvignon Blanc", price: "790 Ft/dl", badge: "Prémium fehér" },
      { name: "Írottkő Házasítás Cuvée Prémium", price: "890 Ft/dl", badge: "Ház kincse" }
    ]
  },
  {
    id: "spirit-bar",
    slug: "ital",
    name: "Ital- & Koktélbár",
    icon: "🍸",
    location: "Középen, a tánctér szívében",
    shortDesc: "Prémium ginek, whiskyk, rumok és friss signature koktélok.",
    accent: "from-purple-600/30 to-blue-900/10",
    borderColor: "border-purple-500/30",
    items: [
      { name: "Bacardí rum (4cl)", price: "2 200 Ft", badge: "Santiago de Cuba · 1862" },
      { name: "Bombay Sapphire Gin & Tonic (Prémium)", price: "1 890 Ft", badge: "Bestseller" },
      { name: "Diplomático Reserva Exclusiva Rum (4cl)", price: "1 650 Ft", badge: "Karibi luxus" },
      { name: "Glenfiddich 12y Single Malt (4cl)", price: "1 790 Ft", badge: "Single Malt" },
      { name: "Írottkő Signature Espresso Martini", price: "2 190 Ft", badge: "Ház Specialitása" },
      { name: "Aperol Spritz (Proseccóval és naranccsal)", price: "1 590 Ft", badge: "Klasszikus" }
    ]
  },
  {
    id: "vip-bar",
    slug: "vip",
    name: "VIP Pezsgőbár & Lounge",
    icon: "✦",
    location: "Galéria VIP Szektor (Exkluzív karszalaggal)",
    shortDesc: "Pezsgők és palackos italok, saját pult a galérián.",
    accent: "from-yellow-600/30 to-amber-900/15",
    borderColor: "border-yellow-500/40",
    items: [
      { name: "Moët & Chandon Impérial Brut (0.75l)", price: "24 900 Ft", badge: "VIP Exkluzív" },
      { name: "Veuve Clicquot Brut Champagne", price: "27 500 Ft", badge: "VIP Kincs" },
      { name: "Valdobbiadene Prosecco Superiore DOCG", price: "8 900 Ft", badge: "Olasz pezsgő" },
      { name: "Grey Goose Vodka Palack (0.7l) + 6 Red Bull", price: "29 000 Ft", badge: "Bottle Service" }
    ]
  }
];

// Ticket prices and sales windows live in the database (supabase/seed_2027.sql);
// the site reads them live (src/lib/usePricing.js). Only the descriptions are here.
export const TICKET_PERKS = {
  standard: [
    "Belépés az est teljes idejére",
    "Mindhárom bár és a tánctér",
    "Mindhárom DJ szettje",
    "Digitális jegy Apple és Google Wallethez",
  ],
  vip: [
    "Minden, ami a normál jegyben",
    "VIP galéria saját pulttal",
    "Soron kívüli belépés",
    "Welcome drink érkezéskor",
  ],
};
