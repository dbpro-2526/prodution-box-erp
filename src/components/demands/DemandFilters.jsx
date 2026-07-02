// src/components/demands/DemandFilters.jsx
import React from 'react';

export default function DemandFilters() {
  // Placeholder: connect to state or URL params for filters
  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <input placeholder="Search by ID or requester" className="border rounded px-3 py-2" />
        <select className="border rounded px-3 py-2">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>
  );
}
