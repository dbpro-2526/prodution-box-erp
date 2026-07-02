// src/components/ui/FileUploader.jsx
import React from 'react';

export default function FileUploader({ onFilesSelected }) {
  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    onFilesSelected && onFilesSelected(files);
  };

  return (
    <div>
      <label className="block text-sm font-medium">Attachments</label>
      <input type="file" multiple onChange={handleChange} className="mt-1" />
    </div>
  );
}
