// src/pages/demands/DemandList.jsx
import React from 'react';
import { useDemands } from '../../hooks/useDemands';
import DemandTable from '../../components/demands/DemandTable';
import DemandFilters from '../../components/demands/DemandFilters';

export default function DemandList() {
  const { demands, loading } = useDemands({});

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Demands</h1>
      <DemandFilters />
      {loading ? <div>Loading...</div> : <DemandTable demands={demands} />}
    </div>
  );
}
