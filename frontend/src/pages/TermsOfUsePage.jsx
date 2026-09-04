import { useNavigate, useLocation } from 'react-router-dom';

function SectionIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-umd-red shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default function TermsOfUsePage() {
  const navigate = useNavigate();
  const location = useLocation();
  // location.key is "default" only when this page is the first thing loaded (deep link),
  // in which case there's no in-app history to go back to.
  const goBack = () => (location.key === 'default' ? navigate('/menu') : navigate(-1));

  return (
    <div className="umd-container max-w-2xl mx-auto px-4 py-10">
      <button onClick={goBack} className="text-xs font-semibold text-umd-body hover:text-umd-red inline-flex items-center gap-1 mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-10">
        <span className="umd-overline text-umd-red text-xs">Legal</span>
        <h1 className="text-4xl umd-hero-title text-umd-black mt-1 mb-2">Terms of Use</h1>
        <p className="text-umd-body text-sm">Last updated July 2026</p>
      </div>

      <div className="space-y-6">
        <div className="umd-card rounded-2xl p-6 border-l-4 border-umd-red">
          <div className="flex items-start gap-3">
            <SectionIcon path="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            <div>
              <h2 className="text-lg font-bold text-umd-black mb-1">Introduction</h2>
              <p className="text-sm text-umd-body">
                Welcome to TerpDining. These Terms of Use ("Terms") govern your use of the
                TerpDining website and mobile apps, a dining menu, macro tracking, and recipe
                tool for students at the University of Maryland. TerpDining is{' '}
                <strong className="text-umd-black">
                  not affiliated with, endorsed by, or operated by the University of Maryland
                </strong>
                . By accessing or using TerpDining, you agree to be bound by these Terms.
              </p>
            </div>
          </div>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <SectionIcon path="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            <h2 className="text-lg font-bold text-umd-black">Use of TerpDining</h2>
          </div>
          <p className="text-sm text-umd-body">
            TerpDining provides dining hall menus and nutrition information aggregated from the
            University of Maryland's public nutrition website, along with food tracking and
            AI-generated recipe suggestions. TerpDining aims to make dining decisions easier but
            does not guarantee the accuracy, timeliness, or completeness of the information
            provided. Menus change, nutrition values are approximate, and AI-generated recipe
            suggestions may be inaccurate.
          </p>
          <p className="text-sm text-umd-body bg-umd-gray-light rounded-lg px-3 py-2">
            <strong className="text-umd-black">Allergen notice</strong>: dietary and allergen
            badges are informational only and may be incomplete or out of date. If you have a
            food allergy or dietary restriction, always confirm directly with dining hall staff
            before eating.
          </p>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <SectionIcon path="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            <h2 className="text-lg font-bold text-umd-black">Reviews and user content</h2>
          </div>
          <p className="text-sm text-umd-body">
            TerpDining lets signed-in users post star ratings and written reviews of dining hall
            dishes. Reviews are public, are attributed to the display name you choose (or
            "Anonymous" if you leave it blank), and are append-only — they cannot be edited or
            deleted from within the app.
          </p>
          <p className="text-sm text-umd-body">
            You are solely responsible for the content you post, and you confirm you have the
            right to post it. By posting, you grant TerpDining a non-exclusive, royalty-free
            license to display, store, and distribute that content within the app.
          </p>
          <div className="text-sm text-umd-body space-y-1.5">
            <p className="font-semibold text-umd-black">You agree not to post content that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>is unlawful, defamatory, harassing, threatening, or hateful;</li>
              <li>is obscene, sexually explicit, or otherwise objectionable;</li>
              <li>targets or identifies dining hall staff or other individuals;</li>
              <li>is spam, advertising, or deliberately false or misleading; or</li>
              <li>infringes anyone else's intellectual property or privacy rights.</li>
            </ul>
          </div>
          <p className="text-sm text-umd-body bg-umd-gray-light rounded-lg px-3 py-2">
            <strong className="text-umd-black">Moderation</strong>: reviews are automatically
            screened for offensive language and rate-limited to curb spam. We may remove any
            review and suspend or terminate any account that violates these Terms, at our sole
            discretion and without notice. Reviews reflect the opinions of individual users, not
            TerpDining or the University of Maryland. To report a review, email{' '}
            <a href="mailto:terpdining@gmail.com" className="text-umd-red font-semibold hover:underline">
              terpdining@gmail.com
            </a>{' '}
            and we'll review it promptly.
          </p>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <SectionIcon path="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            <h2 className="text-lg font-bold text-umd-black">Intellectual property</h2>
          </div>
          <p className="text-sm text-umd-body">
            The TerpDining application, including its design, code, graphics, and the
            compilation of content displayed, is owned by its developer or used with
            permission. Menu and nutrition data is sourced from the University of Maryland's
            public nutrition website and remains subject to the terms of that platform. UMD
            names and marks belong to the University of Maryland.
          </p>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <SectionIcon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            <h2 className="text-lg font-bold text-umd-black">Disclaimer of liability</h2>
          </div>
          <p className="text-sm text-umd-body">
            All information on TerpDining is provided "as is" without warranty of any kind,
            express or implied. TerpDining shall not be liable for any inaccuracies or
            discrepancies in menu, nutrition, allergen, or recipe information, or for any
            decisions made in reliance on it.
          </p>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <SectionIcon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            <h2 className="text-lg font-bold text-umd-black">Changes to these Terms</h2>
          </div>
          <p className="text-sm text-umd-body">
            TerpDining reserves the right to modify these Terms at any time without direct
            notification to users. By continuing to access or use TerpDining after revisions
            become effective, you agree to be bound by the revised Terms.
          </p>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <SectionIcon path="M12 21a8.25 8.25 0 100-16.5 8.25 8.25 0 000 16.5zm0 0c1.657 0 3-3.694 3-8.25S13.657 4.5 12 4.5 9 8.194 9 12.75s1.343 8.25 3 8.25zm-8.25-8.25h16.5" />
            <h2 className="text-lg font-bold text-umd-black">Governing law</h2>
          </div>
          <p className="text-sm text-umd-body">
            These Terms shall be governed by and construed in accordance with the laws of the
            State of Maryland, United States, without regard to its conflict of law provisions.
          </p>
        </div>

        <div className="umd-card rounded-2xl p-6 space-y-2">
          <div className="flex items-center gap-2">
            <SectionIcon path="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            <h2 className="text-lg font-bold text-umd-black">Contact us</h2>
          </div>
          <p className="text-sm text-umd-body">
            For any questions or concerns regarding these Terms, contact{' '}
            <a href="mailto:terpdining@gmail.com" className="text-umd-red font-semibold hover:underline">
              terpdining@gmail.com
            </a>
            .
          </p>
        </div>

        <p className="text-sm text-umd-body text-center px-4">
          By using TerpDining, you acknowledge that you have read, understood, and agree to be
          bound by these Terms.
        </p>
      </div>
    </div>
  );
}
