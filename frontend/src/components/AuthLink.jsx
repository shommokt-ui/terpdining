import { Link, useLocation } from 'react-router-dom';
import { authReturnTo } from '../lib/authNavigation';

// Use for links into or between account forms so cancellation keeps its origin.
export default function AuthLink(props) {
  const location = useLocation();
  return <Link {...props} state={{ returnTo: authReturnTo(location) }} />;
}
