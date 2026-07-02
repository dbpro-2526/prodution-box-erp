// src/pages/demands/DemandDetails.jsx
import React, { useEffect, useState } from 'react';
import { fetchDemand, updateDemandStatus } from '../../services/demandService';
import Swal from 'sweetalert2';

export default function DemandDetails({ demandId, currentUser }) {
  const [demand, setDemand] = useState(null);

  useEffect(() => {
    async function load() {
      const d = await fetchDemand(demandId);
      setDemand(d);
    }
    load();
  }, [demandId]);

  if (!demand) return <div className="p-4">Loading...</div>;

  const handleApprove = async () => {
    try {
      await updateDemandStatus(demandId, { status: 'approved', byUid: currentUser.uid, role: currentUser.role, comment: 'Approved via UI' });
      Swal.fire('Approved', 'Demand approved', 'success');
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to approve', 'error');
    }
  };

  const handleReject = async () => {
    const { value: text } = await Swal.fire({ title: 'Reject comment', input: 'text', showCancelButton: true });
    if (text) {
      await updateDemandStatus(demandId, { status: 'rejected', byUid: currentUser.uid, role: currentUser.role, comment: text });
      Swal.fire('Rejected', 'Demand rejected', 'info');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Demand Details</h1>
      <div className="mt-4">
        <pre className="bg-white p-3 rounded shadow-sm">{JSON.stringify(demand, null, 2)}</pre>
      </div>
      <div className="mt-4 space-x-2">
        <button onClick={handleApprove} className="btn btn-success">Approve</button>
        <button onClick={handleReject} className="btn btn-danger">Reject</button>
      </div>
    </div>
  );
}
