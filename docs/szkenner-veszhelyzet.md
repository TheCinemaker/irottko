# Beléptetés – vészhelyzeti eljárás

## Kapunyitás előtt (kötelező)
1. **Minden kapus telefon bejelentkezik** a szkennerbe (`/scan`). A belépés 24 órán át él,
   és a lenti zárak nem érintik.
2. **Az admin is bejelentkezik** (`/admin`, 12 óra), hogy szükség esetén QR-kódot adhasson ki.
3. **A vészhelyzeti vendéglista** (Admin → Beléptetés → „Lista nyomtatása”) minden kapuhoz kinyomtatva.

## „Túl sok hibás próbálkozás” – a PIN-es belépés le van zárva
Ok: valaki (vagy egy támadó, sok címről) sok hibás PIN-t küldött. 15 perc után magától feloldódik.
A **már bejelentkezett telefonok tovább működnek.**

**Új telefon felvétele zár alatt – PIN nélkül:**
Admin → Beléptetés → „Kapus telefon hozzáadása PIN nélkül” → név → „QR-kód készítése”
→ a kapus a telefonja kamerájával beolvassa → a szkenner 24 órára bejelentkezik.
A kód 10 percig érvényes, egyszer használható, visszavonható. Ne fotózd le, ne küldd tovább.

**Kézi feloldás (csak ha a QR-kód sem megoldás):** Supabase → SQL Editor:
```sql
delete from public.pin_failures where scope = 'scanner';   -- vagy 'admin'
```
A támadó újra lezárhatja – ez csak időt nyer. A PIN-védelmet NEM kapcsoljuk ki.

## Az admin sem tud belépni (admin-zár)
Az előre bejelentkezett admin-böngésző működik. Ha nincs ilyen: a fenti SQL `scope = 'admin'`-nal,
utána azonnal belépni.

## Kiszivárgott a PIN
Netlify → Environment variables → `SCANNER_PIN` (vagy `ADMIN_PIN`) új, legalább 8 jegyű értékre
→ új deploy. **Minden eszköz kijelentkezik** (a QR-kóddal felvettek is) → újra belépés / új QR.

## Nincs net – offline mód (magától megy)
Belépés után a szkenner letölti az összes érvényes jegyet, és percenként frissíti.
**Ezért kapunyitás előtt minden kapus telefon lépjen be netes helyen**, és várja meg a
„Offline lista: N jegy · frissítve …” sort a számlálók alatt.

Ha elmegy a net: narancs sáv „OFFLINE – a letöltött listából ellenőrzök”. A beolvasás
ugyanúgy megy (zöld / piros), a beengedések a telefonon várnak, és a net visszajöttével
maguktól feltöltődnek („N feltöltésre vár”). Az oldal net nélkül újratöltve is megnyílik.
- **Narancs „Nincs a listában”**: friss (pár perce vett) jegy lehet. Nézd meg a vendég
  telefonján a jegyet és a nevet, kérj igazolványt → „Rendben, beengedem” vagy „Nem engedem be”.
- **Piros sáv feltöltés után**: egy offline beengedett jegyet egy másik kapu is beengedett
  (lefotózott QR) – az admin duplázóként mutatja.
- Kilépéskor a lista törlődik a telefonról; a még fel nem töltött beengedések megmaradnak,
  és a következő belépéskor felmennek. A lista a buli után magától törlődik.
- A telefonon nem a jegykódok vannak, csak ujjlenyomatuk (SHA-256) + név + jegytípus:
  elveszett telefonból nem lehet érvényes jegyet gyártani.

## Nincs net és a lista sincs letöltve
Piros sáv. Nyomtatott vendéglista: név + jegykód, kipipálni, igazolványt kérni. Ha
visszajön a net, a kódokat utólag beolvasni.

## Titkok cseréje (ritkán)
- `SESSION_SECRET`: a régit tedd a `SESSION_SECRET_PREVIOUS`-ba → a bent lévő eszközök maradnak.
- `ORDER_LINK_SECRET`: a régit tedd az `ORDER_LINK_SECRET_PREVIOUS`-ba → a vendégeknek kiküldött
  „Jegyeim” linkek tovább működnek. Csak a rendezvény után töröld.
