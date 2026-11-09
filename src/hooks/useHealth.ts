import { useEffect, useState } from 'react';
import { getHealth, type HealthInfo } from '@/services/ai';

/**
 * Reports whether the app is running with live AI or the built-in simulation.
 * The UI uses this to label simulated output honestly, everywhere.
 */
export function useHealth(): { health: HealthInfo | null; loading: boolean; error: string | null } {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getHealth()
      .then((h) => {
        if (alive) setHealth(h);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { health, loading, error };
}

export const isDemo = (health: HealthInfo | null): boolean => !health?.hasKey;
