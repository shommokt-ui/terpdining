import { Link } from 'react-router-dom';

function SectionIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-umd-red shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="umd-container max-w-2xl mx-auto px-4 py-10">
      <Link to="/login" className="text-xs font-semibold text-umd-body hover:text-umd-red inline-flex items-center gap-1 mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to sign in
      </Link>

      <div className="mb-10">
        <span className="umd-overline text-umd-red text-xs">Legal</span>
        <h1 className="text-4xl umd-hero-title text-umd-black mt-1 mb-2">Privacy Policy</h1>
        <p className="text-umd-body text-sm">Last updated July 2026</p>
      </div>

      <div className="space-y-6">
          <div className="umd-card rounded-2xl p-6 border-l-4 border-umd-red">
            <div className="flex items-start gap-3">
              <SectionIcon path="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              <div>
                <h2 className="text-lg font-bold text-umd-black mb-1">Who we are</h2>
                <p className="text-sm text-umd-body">
                  TerpDining is an independent, unofficial student project. It is{' '}
                  <strong className="text-umd-black">
                    not affiliated with, endorsed by, or operated by the University of Maryland
                  </strong>
                  . Dining hall menu data is sourced from UMD's public nutrition website for
                  informational convenience only.
                </p>
              </div>
            </div>
          </div>

          <div className="umd-card rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <SectionIcon path="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.286z" />
              <h2 className="text-lg font-bold text-umd-black">Information we collect</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm text-umd-body">
              <li>
                <strong className="text-umd-black">Account information</strong>: the email address
                and password you register with. Your password is stored securely; we never have
                access to your plaintext password.
              </li>
              <li>
                <strong className="text-umd-black">Favorites</strong>: the names of menu items you
                mark as favorites.
              </li>
              <li>
                <strong className="text-umd-black">Food tracker logs</strong>: the foods, portions,
                and dates you log, plus any macro goals you set.
              </li>
              <li>
                <strong className="text-umd-black">Recipe requests</strong>: the dining hall, meal,
                cuisine, and dietary goals you submit to the AI recipe creator, along with the
                generated suggestions, so you can revisit past recipe sessions.
              </li>
            </ul>
            <p className="text-sm text-umd-body bg-umd-gray-light rounded-lg px-3 py-2">
              We do not collect payment information, location data, or contacts.
            </p>
          </div>

          <div className="umd-card rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <SectionIcon path="M13 10V3L4 14h7v7l9-11h-7z" />
              <h2 className="text-lg font-bold text-umd-black">How we use it</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm text-umd-body">
              <li>To operate your account (login, favorites, tracker history, saved recipe sessions).</li>
              <li>
                To generate recipe suggestions: your recipe request (dining hall, meal, cuisine,
                goals, and the day's available menu items) is sent to{' '}
                <strong className="text-umd-black">OpenAI</strong> to generate the response.
                OpenAI's API does not use this data to train its models by default.
              </li>
              <li>
                To send you a password reset email via{' '}
                <strong className="text-umd-black">Resend</strong>, only when you request one.
                Resend receives your email address and the reset link, nothing else.
              </li>
            </ul>
            <p className="text-sm text-umd-body bg-umd-gray-light rounded-lg px-3 py-2">
              We do not sell your data or share it with advertisers.
            </p>
          </div>

          <div className="umd-card rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <SectionIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              <h2 className="text-lg font-bold text-umd-black">Data retention</h2>
            </div>
            <p className="text-sm text-umd-body">
              Your account data (favorites, tracker logs, goals, recipe sessions) persists until you
              delete it or ask us to delete your account. Password reset tokens expire after 1 hour
              whether or not they're used.
            </p>
          </div>

          <div className="umd-card rounded-2xl p-6 space-y-2">
            <div className="flex items-center gap-2">
              <SectionIcon path="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              <h2 className="text-lg font-bold text-umd-black">Contact</h2>
            </div>
            <p className="text-sm text-umd-body">
              Questions about this policy or a data deletion request? Contact{' '}
              <a href="mailto:shommokt@gmail.com" className="text-umd-red font-semibold hover:underline">
                shommokt@gmail.com
              </a>
              .
            </p>
          </div>
      </div>
    </div>
  );
}
