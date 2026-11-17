import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { Flap } from '../components/LineupBoard';

/*
  404 – "Gate not found": any address that is not a page of the site.
  A small split-flap sign in the site's airport language, and the way back.
*/
export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Gate not found · ONE NIGHT AT ÍROTTKŐ';
  }, []);
  return (
    <PageShell>
      <section className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-5 pt-24 text-center">
        <div className="kicker">Utastájékoztatás · Hiba 404</div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-hidden="true">
          <Flap chars="GATE" on delay={0} />
          <Flap chars="404" on delay={300} />
        </div>
        <h1 className="display mt-8 text-[2.2rem] leading-tight sm:text-5xl">Ez a kapu nem létezik.</h1>
        <p className="mt-4 text-[15px] text-gray-400">
          Lehet, hogy elírták a kapuszámot, vagy ez a járat már elment. A terminálból mindenhová eljutsz.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className="btn-primary px-6">
            Vissza a terminálba
          </Link>
          <Link to="/jegyek" className="btn-secondary px-6">
            Check-in
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
