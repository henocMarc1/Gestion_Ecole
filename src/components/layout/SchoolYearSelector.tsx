'use client';

import { useSchoolYear } from '@/context/SchoolYearContext';

export function SchoolYearSelector() {
  const { years, selectedYearId, setSelectedYearId, isLoading } = useSchoolYear();

  if (isLoading || years.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-neutral-600 whitespace-nowrap">Annee:</label>
      <select
        value={selectedYearId}
        onChange={(e) => setSelectedYearId(e.target.value)}
        className="h-9 w-[130px] md:min-w-[170px] md:w-auto rounded-lg border border-neutral-300 bg-white px-2 md:px-3 text-sm text-neutral-800"
      >
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.name}
            {year.is_current ? ' (Actuelle)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
