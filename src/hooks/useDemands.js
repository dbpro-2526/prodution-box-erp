// src/hooks/useDemands.js
import { useEffect, useState, useCallback } from 'react';
import { listenDemands, getDemandById } from '../services/demandService';

export function useDemands(filters = {}) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = listenDemands({ filters, onUpdate: (items) => {
      setDemands(items);
      setLoading(false);
    }});

    return () => unsub();
  }, [JSON.stringify(filters)]);

  const refresh = useCallback(() => {
    // simple re-run by toggling filters (consumer can change key)
  }, []);

  return { demands, loading, refresh };
}

export async function fetchDemand(id) {
  return await getDemandById(id);
}
