/*
  Scroll-scrubbed pour clips shown on /barok, top to bottom.

  To add a clip (e.g. wine, beer):
   1. Generate a 9:16 clip on a black background (Google Flow), put the raw mp4 in _video-original/.
   2. Extract frames:  ffmpeg -i <clip>.mp4 -vf "fps=12,scale=900:-2" -c:v libwebp -quality 72 public/frames/<dir>/f%03d.webp
   3. Add an entry below, and the drink itself to BARS_DATA in eventData.js.

  RULES for copy: only verified facts about the brand. No sales language:
  no discounts, struck-through prices or "limited quantity" wording.

  captions: from/to = share of this clip's scroll (0..1). pos = 'top' | 'bottom'
  on phones (desktop always shows them in a side column). Pick the side where
  the footage is empty black at that moment.
*/
export const POUR_CLIPS = [
  {
    id: 'bacardi',
    bar: 'spirit-bar',
    dir: 'rum-portrait',
    count: 120,
    // Bacardí facts (checked 2026-11-03): founded 1862 in Santiago de Cuba by
    // Don Facundo Bacardí Massó; bat logo per brand legend (fruit bats in the
    // first distillery, suggested by Doña Amalia); Daiquirí & Cuba Libre are
    // tied to Bacardí rum.
    captions: [
      // windows may overlap with the previous caption's slow fade-out when they
      // sit in different places; same place -> the later one waits automatically
      { from: 0.11, to: 0.31, pos: 'bottom', kicker: '01 — 1862', title: 'Santiago de Cuba', text: 'Don Facundo Bacardí Massó itt alapította a házat.' },
      { from: 0.31, to: 0.47, pos: 'top', kicker: '02 — A denevér', title: 'Szerencsét hoz', text: 'A legenda szerint az első lepárló gerendái közt denevérek laktak — Doña Amalia ötletére lettek a jelkép.' },
      { from: 0.53, to: 0.71, pos: 'top', kicker: '03 — Klasszikusok', title: 'Daiquirí. Cuba Libre.', text: 'Két kubai klasszikus, mindkettő a Bacardí rumhoz kötődik.' },
    ],
    finale: { kicker: 'Koktélbár', title: 'BACARDÍ', line: 'Santiago de Cuba · 1862 óta' },
  },
  {
    id: 'tokaji',
    // Detached 2026-11-13: the wine bar is Jagodics Pince (Kőszeg); Tokaj captions
    // would mislead there. New film coming – re-attach with bar: 'wine-bar'.
    bar: null,
    dir: 'wine-portrait',
    count: 120,
    // Tokaji facts (checked 2026-11-03): 1737 decree of Charles VI made Tokaj one
    // of the world's first closed wine regions (UNESCO); Tokaj Wine Region
    // Historic Cultural Landscape = World Heritage since 2002; aszú berries are
    // shrivelled on the vine by noble rot (Botrytis cinerea); Kölcsey's Himnusz:
    // "Tokaj szőlővesszein / Nektárt csepegtettél". NOT used: "Vinum regum, rex
    // vinorum" (attribution disputed). Producer name on the AI label is garbled.
    captions: [
      { from: 0.11, to: 0.31, pos: 'bottom', kicker: '01 — 1737', title: 'Zárt borvidék', text: 'VI. Károly rendelete a világ egyik első zárt borvidékévé tette Tokajt.' },
      { from: 0.31, to: 0.47, pos: 'top', kicker: '02 — Aszúszem', title: 'Nemes rothadás', text: 'Az aszúszemeket a Botrytis cinerea aszalja töppedtre, még a tőkén.' },
      { from: 0.53, to: 0.71, pos: 'top', kicker: '03 — Himnusz', title: 'Nektárt csepegtettél', text: '„Tokaj szőlővesszein / Nektárt csepegtettél" — Kölcsey Ferenc' },
    ],
    finale: { kicker: 'Borbár', title: 'TOKAJI ASZÚ', line: 'UNESCO világörökség · 2002' },
  },
];
