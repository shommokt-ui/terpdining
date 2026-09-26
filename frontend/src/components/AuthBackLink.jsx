import { Link, useLocation } from 'react-router-dom';
import { authReturnTo } from '../lib/authNavigation';

export default function AuthBackLink() {
  const location = useLocation();
  return (
    <Link
      to={authReturnTo(location)}
      replace
      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-umd-red hover:underline mb-4"
    >
      <span aria-hidden="true">←</span> Back to browsing
    </Link>
  );
}
