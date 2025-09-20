import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useRecords } from '@/context/RecordsContext';

export const SearchBar: React.FC = () => {
  const { searchTerm, setSearchTerm } = useRecords();
  const [local, setLocal] = useState(searchTerm || '');

  useEffect(() => {
    setLocal(searchTerm || '');
  }, [searchTerm]);

  // Debounce updates to the shared context
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(local), 200);
    return () => clearTimeout(t);
  }, [local, setSearchTerm]);

  return (
    <div className="mb-4">
      <Input placeholder="Search by patient, id or diagnosis..." value={local} onChange={(e) => setLocal((e.target as HTMLInputElement).value)} />
    </div>
  );
};

export default SearchBar;
