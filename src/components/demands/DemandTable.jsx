// src/components/demands/DemandTable.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function DemandTable({ demands }) {
  if (!demands || !demands.length) return <div className="mt-4">No demands found.</div>;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Created By</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Created At</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {demands.map((d) => (
            <tr key={d.id} className="border-t">
              <td className="px-4 py-2">{d.id}</td>
              <td className="px-4 py-2">{d.createdBy?.name || d.createdBy?.uid}</td>
              <td className="px-4 py-2">{d.status}</td>
              <td className="px-4 py-2">{d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleString() : '-'}</td>
              <td className="px-4 py-2"><Link to={`/demands/${d.id}`} className="text-blue-600">View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
