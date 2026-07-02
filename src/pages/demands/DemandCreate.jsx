// src/pages/demands/DemandCreate.jsx
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { createDemand } from '../../services/demandService';
import FileUploader from '../../components/ui/FileUploader';
import Swal from 'sweetalert2';

export default function DemandCreate({ currentUser }) {
  const { register, handleSubmit, control } = useForm();
  const [attachments, setAttachments] = useState([]);

  const onSubmit = async (data) => {
    try {
      const demand = {
        createdBy: { uid: currentUser.uid, name: currentUser.name, role: currentUser.role },
        target: data.target,
        items: data.items || [],
        note: data.note || null,
      };

      const id = await createDemand(demand, attachments);
      Swal.fire('Success', 'Demand created', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Failed to create demand', 'error');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">New Demand</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Target Warehouse / Division</label>
          <input {...register('target.warehouseId')} className="mt-1 block w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Items (JSON)</label>
          <textarea {...register('items')} placeholder='[ { "itemId": "", "requestedQty": 5 } ]' className="mt-1 block w-full h-28" />
        </div>
        <div>
          <label className="block text-sm font-medium">Note</label>
          <textarea {...register('note')} className="mt-1 block w-full h-20" />
        </div>

        <div>
          <FileUploader onFilesSelected={(files) => setAttachments(files)} />
        </div>

        <div>
          <button type="submit" className="btn btn-primary">Create Demand</button>
        </div>
      </form>
    </div>
  );
}
