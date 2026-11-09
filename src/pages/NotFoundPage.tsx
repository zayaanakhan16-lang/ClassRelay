import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Compass className="mx-auto h-9 w-9 text-muted" aria-hidden="true" />
        <h1 className="display mt-4 text-2xl text-ink">This page is not here</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The link may be old or mistyped. Everything ClassRelay does is reachable from the two places below.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/start" className="btn-primary">
            Start teaching
          </Link>
          <Link to="/peers" className="btn-secondary">
            Explore peer learning
          </Link>
        </div>
      </div>
    </div>
  );
}
