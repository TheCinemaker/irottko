import { Link } from 'react-router-dom';
import PageShell, { PageHeader } from '../components/PageShell';
import { EVENT_DETAILS } from '../data/eventData';
import { SELLER, OPERATOR, HOSTING, DB_REGION, RETENTION_DAYS_AFTER_EVENT, LEGAL_DRAFT, LEGAL_UPDATED } from '../data/legal';

/*
  ÁSZF, adatkezelési tájékoztató, impresszum.
  DRAFT: written from how the platform actually works; must be reviewed by the
  hotel's lawyer before go-live. Company data comes from src/data/legal.js.
*/

function LegalLayout({ kicker, title, children }) {
  return (
    <PageShell>
      <PageHeader kicker={kicker} title={title}>
        Hatályos: {LEGAL_UPDATED}
      </PageHeader>
      <article className="mx-auto max-w-3xl px-5 pb-28 text-[15px] leading-relaxed text-gray-300 [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[#d4af37] [&_a]:underline">
        {LEGAL_DRAFT && (
          <div className="mb-10 rounded-xl border border-amber-400/40 bg-amber-950/30 p-4 text-[14px] text-amber-200">
            Tervezet – jogi ellenőrzés alatt. A végleges szöveg a rendezvény előtt kerül közzétételre.
          </div>
        )}
        {children}
      </article>
    </PageShell>
  );
}

const Seller = () => (
  <ul>
    <li>Név: {SELLER.name} ({SELLER.shortName})</li>
    <li>Székhely: {SELLER.seat}</li>
    <li>Cégjegyzékszám: {SELLER.regNo} ({SELLER.registry})</li>
    <li>Adószám: {SELLER.taxNo} · NTAK: {SELLER.ntak}</li>
    <li>E-mail: {SELLER.email} · Telefon: {SELLER.phone}</li>
  </ul>
);

/* ------------------------------------------------------------------ */

export function TermsPage() {
  return (
    <LegalLayout kicker="Jogi információk" title="Általános Szerződési Feltételek">
      <p>
        Ezek a feltételek a(z) {EVENT_DETAILS.title} rendezvényre ({EVENT_DETAILS.dateString}, {EVENT_DETAILS.venue}) szóló belépőjegyek
        online megvásárlására vonatkoznak. A jegyvásárlással a Vásárló elfogadja őket.
      </p>

      <h2>1. Az eladó</h2>
      <Seller />
      <p>A jegyértékesítő platformot az eladó megbízásából a(z) {OPERATOR.name} üzemelteti.</p>

      <h2>2. A szerződés létrejötte</h2>
      <p>
        A szerződés elektronikus úton, a fizetés sikeres teljesítésével jön létre. A szerződés nyelve magyar; a szerződést az eladó
        nem iktatja, utólag nem hozzáférhető, a jegyeket és a számlát a Vásárló e-mailben kapja meg. Adatbeviteli hibát a fizetés
        előtt, az űrlapon lehet javítani.
      </p>

      <h2>3. Árak és fizetés</h2>
      <ul>
        <li>A jegyárak bruttó árak, az általános forgalmi adót tartalmazzák. Az ár a vásárlás időpontjától függ (időszakonként emelkedő árazás); a vásárláskor érvényes ár a kosárban látható.</li>
        <li>A fizetés bankkártyával vagy más, a Barion által kínált módon történik, a Barion Payment Zrt. biztonságos fizetési oldalán. A kártyaadatokat az eladó nem látja és nem tárolja.</li>
        <li>A jegyek a fizetés idejére (legfeljebb 15 percre) lefoglalásra kerülnek. Sikertelen vagy megszakított fizetés esetén a foglalás megszűnik, terhelés nem történik.</li>
        <li>Az eladó a vásárlásról elektronikus számlát állít ki, amelyet a Számlázz.hu rendszere e-mailben küld el.</li>
      </ul>

      <h2>4. A jegy</h2>
      <ul>
        <li>A jegyet a Vásárló e-mailben kapja meg (QR-kód, nyomtatható PDF), és hozzáadhatja az Apple Tárcához vagy a Google Wallethez.</li>
        <li>Minden jegy egyedi kóddal rendelkezik, és <strong>egyszeri belépésre</strong> jogosít. Az első beolvasás után a kód érvényét veszti; a jegy másolata nem jogosít belépésre.</li>
        <li>
          A jegy <strong>névre szóló</strong>: a vásárláskor megadott résztvevő nevét tartalmazza, és csak ő léphet be vele. Nem átruházható,
          és nem értékesíthető tovább. A beléptetéskor a név ellenőrzése céljából fényképes igazolvány kérhető.
        </li>
        <li>A résztvevő nevének módosítását a rendezvény előtt az eladó e-mail címén ({SELLER.email}) lehet kérni, a rendelésszám megadásával.</li>
        <li>A jegy elvesztése esetén a Vásárló a rendelésszám megadásával kérheti az e-mail újraküldését.</li>
      </ul>

      <h2>5. Belépési feltételek</h2>
      <ul>
        <li>A rendezvény 18 éven felülieknek szól. A belépéskor az életkor igazolását kérhetik (fényképes igazolvány).</li>
        <li>A belépéskor biztonsági ellenőrzés lehet. A házirend, a biztonsági személyzet utasításai és a jogszabályok megsértése a rendezvényről való kizárást vonhatja maga után, ilyenkor a jegy árát nem térítjük vissza.</li>
        <li>A VIP jegy a VIP galéria és a hozzá tartozó szolgáltatások igénybevételére is jogosít.</li>
      </ul>

      <h2>6. Elállási jog</h2>
      <p>
        A 45/2014. (II. 26.) Korm. rendelet 29. § (1) bekezdés l) pontja alapján a Vásárlót <strong>nem illeti meg az elállási jog</strong>,
        mert a szerződés meghatározott időpontban nyújtott szabadidős szolgáltatásra szól. A megvásárolt jegy ezért nem váltható vissza.
      </p>

      <h2>7. A rendezvény elmaradása vagy módosítása</h2>
      <p>
        Ha a rendezvény az eladónak felróható okból elmarad, az eladó a jegy árát a fizetéskor használt módon visszatéríti, és erről
        e-mailben tájékoztatja a Vásárlót. Időpont-módosítás esetén a jegy az új időpontra érvényes; aki az új időpontban nem tud részt
        venni, az új időpont közzétételétől számított 14 napon belül kérheti a jegyár visszatérítését. A fellépők személyének változása nem ad alapot visszatérítésre.
      </p>

      <h2>8. Panaszkezelés</h2>
      <p>
        Panaszt az eladó e-mail címén ({SELLER.email}) lehet tenni; az eladó 30 napon belül írásban válaszol. Ha a panasz rendezése nem
        sikerül, a fogyasztó a lakóhelye szerint illetékes békéltető testülethez fordulhat; az eladó székhelye szerint illetékes:
        Vas Vármegyei Békéltető Testület (9700 Szombathely, Honvéd tér 2.).
      </p>

      <h2>9. Egyéb</h2>
      <p>
        A személyes adatok kezeléséről az <Link to="/adatkezeles">adatkezelési tájékoztató</Link> szól. Az eladó adatait az{' '}
        <Link to="/impresszum">impresszum</Link> tartalmazza. A szerződésre a magyar jog az irányadó.
      </p>
    </LegalLayout>
  );
}

/* ------------------------------------------------------------------ */

export function PrivacyPage() {
  return (
    <LegalLayout kicker="Jogi információk" title="Adatkezelési tájékoztató">
      <p>
        Ez a tájékoztató arról szól, milyen személyes adatokat kezelünk a(z) {EVENT_DETAILS.title} jegyértékesítése és a beléptetés során,
        mire, meddig, és milyen jogai vannak. A tájékoztató az Európai Unió általános adatvédelmi rendelete (GDPR) alapján készült.
      </p>

      <h2>1. Az adatkezelő</h2>
      <Seller />

      <h2>2. Milyen adatokat kezelünk és miért</h2>
      <ul>
        <li>
          <strong>Jegyvásárlás:</strong> név, e-mail cím, telefonszám (nem kötelező), számlázási cím, céges vásárlásnál cégnév és adószám,
          a megvásárolt jegyek és a fizetés azonosítója. Cél: a jegy kiadása és a szerződés teljesítése. Jogalap: szerződés teljesítése
          (GDPR 6. cikk (1) b)).
        </li>
        <li>
          <strong>Számlázás:</strong> a számlán szereplő adatok. Jogalap: jogi kötelezettség (GDPR 6. cikk (1) c), az áfatörvény és a
          számviteli törvény).
        </li>
        <li>
          <strong>Beléptetés:</strong> a jegy kódja, a belépés időpontja és a beolvasás eredménye. Cél: hogy egy jegy csak egyszer
          léphessen be, és a rendezvény biztonsága. Jogalap: szerződés teljesítése és az adatkezelő jogos érdeke (GDPR 6. cikk (1) b) és f)).
        </li>
        <li>
          <strong>Visszaélések megelőzése:</strong> a foglalást indító eszköz IP-címe. Cél: hogy egy forrásból ne lehessen tömegesen,
          fizetés nélkül lefoglalni a jegyeket. Jogalap: az adatkezelő jogos érdeke (GDPR 6. cikk (1) f)).
        </li>
      </ul>
      <p>Bankkártyaadatot nem kezelünk: azt kizárólag a Barion Payment Zrt. kapja meg, a saját adatkezelési tájékoztatója szerint.</p>

      <h2>3. Meddig őrizzük az adatokat</h2>
      <ul>
        <li>A rendelési, jegy- és beléptetési adatokat a rendezvény után {RETENTION_DAYS_AFTER_EVENT} napig (az esetleges panaszok rendezéséig), utána töröljük.</li>
        <li>A számlát és a számviteli bizonylatokat a számviteli törvény szerint 8 évig.</li>
      </ul>

      <h2>4. Kik férnek hozzá az adatokhoz (adatfeldolgozók)</h2>
      <ul>
        <li>{OPERATOR.name} – a platform üzemeltetése.</li>
        <li>Supabase, Inc. – adatbázis ({DB_REGION}).</li>
        <li>{HOSTING.name} – a weboldal és a szerverfunkciók tárhelye (USA).</li>
        <li>Resend (Plus Five Five, Inc.) – a jegyküldő e-mailek kézbesítése (USA).</li>
        <li>KBOSS.hu Kft. (Számlázz.hu) – számlakészítés és -küldés.</li>
        <li>Barion Payment Zrt. – a fizetés lebonyolítása (önálló adatkezelőként).</li>
      </ul>
      <p>
        Az USA-ba irányuló adattovábbítás az Európai Bizottság általános szerződési feltételei (SCC), illetve az EU–USA adatvédelmi
        keretrendszer alapján történik. Ha a Vásárló a jegyét az Apple Tárcához vagy a Google Wallethez adja, a jegy adatai (név, jegykód,
        jegytípus) az Apple, illetve a Google rendszerébe kerülnek, azok saját feltételei szerint.
      </p>

      <h2>5. Sütik</h2>
      <p>
        A weboldal nem használ követő, reklám- vagy elemző sütiket. Csak a működéshez szükséges, a böngészőben tárolt technikai
        adatokat használ (például a beléptető személyzet bejelentkezését, illetve a „Jegyem” részben a megvásárolt jegyeket ezen az eszközön), ezekhez nem kell hozzájárulás. A „Jegyem” adatai nem kerülnek a szerverre, és az „Eltávolítás” gombbal vagy a böngészőadatok törlésével bármikor törölhetők.
      </p>

      <h2>6. Az Ön jogai</h2>
      <p>
        Kérhet tájékoztatást az adatairól, kérheti azok helyesbítését, törlését (ha nincs jogszabályi megőrzési kötelezettség),
        kezelésük korlátozását, tiltakozhat a jogos érdeken alapuló adatkezelés ellen, és kérheti adatai hordozható formában történő
        kiadását. Kérését a(z) {SELLER.email} címre küldje; 30 napon belül válaszolunk.
      </p>
      <p>
        Panaszt a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH, 1055 Budapest, Falk Miksa utca 9–11., www.naih.hu)
        tehet, vagy bírósághoz fordulhat.
      </p>
    </LegalLayout>
  );
}

/* ------------------------------------------------------------------ */

export function ImprintPage() {
  return (
    <LegalLayout kicker="Jogi információk" title="Impresszum">
      <h2>Az eladó és a weboldal üzemeltetője</h2>
      <Seller />
      <p>
        Weboldal: <a href={SELLER.web} target="_blank" rel="noreferrer">{SELLER.web.replace('https://', '')}</a>
      </p>

      <h2>A jegyértékesítő platform fejlesztője és üzemeltetője</h2>
      <ul>
        <li>{OPERATOR.name}, {OPERATOR.form}</li>
        <li>Cím: {OPERATOR.seat}</li>
        <li>Adószám: {OPERATOR.taxNo}</li>
        <li>E-mail: {OPERATOR.email} · Telefon: {OPERATOR.phone}</li>
      </ul>

      <h2>Tárhelyszolgáltató</h2>
      <ul>
        <li>{HOSTING.name}</li>
        <li>{HOSTING.address}</li>
        <li>
          <a href={HOSTING.web} target="_blank" rel="noreferrer">{HOSTING.web.replace('https://', '')}</a> · {HOSTING.email}
        </li>
      </ul>

      <h2>Fizetési szolgáltató</h2>
      <ul>
        <li>Barion Payment Zrt.</li>
        <li>Székhely: 1083 Budapest, Bókay János utca 44–46. C5. ép. 8. em.</li>
        <li>Cégjegyzékszám: 01-10-048552</li>
        <li>MNB engedélyszám: H-EN-I-1064/2013 · MNB intézményazonosító: 25353192</li>
      </ul>

      <p className="pt-6">
        <Link to="/aszf">Általános Szerződési Feltételek</Link> · <Link to="/adatkezeles">Adatkezelési tájékoztató</Link>
      </p>
    </LegalLayout>
  );
}
