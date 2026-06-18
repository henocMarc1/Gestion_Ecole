'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type SchoolYear = {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
};

type SchoolYearContextValue = {
  years: SchoolYear[];
  selectedYearId: string;
  selectedYear: SchoolYear | null;
  isLoading: boolean;
  setSelectedYearId: (yearId: string) => void;
  refreshYears: () => Promise<void>;
};

const SchoolYearContext = createContext<SchoolYearContextValue | undefined>(undefined);

function getStorageKey(schoolId?: string | null) {
  return `selected_school_year:${schoolId || 'none'}`;
}

export function SchoolYearProvider({
  schoolId,
  children,
}: {
  schoolId?: string | null;
  children: React.ReactNode;
}) {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearIdState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const setSelectedYearId = useCallback(
    (yearId: string) => {
      setSelectedYearIdState(yearId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(getStorageKey(schoolId), yearId);
      }
    },
    [schoolId]
  );

  const refreshYears = useCallback(async () => {
    if (!schoolId) {
      setYears([]);
      setSelectedYearIdState('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('years')
        .select('id, name, start_date, end_date, is_current')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      if (error) throw error;

      const loadedYears = (data || []) as SchoolYear[];
      setYears(loadedYears);

      const stored = typeof window !== 'undefined' ? localStorage.getItem(getStorageKey(schoolId)) : null;
      const hasStored = !!stored && loadedYears.some((y) => y.id === stored);
      const fallback = loadedYears.find((y) => y.is_current)?.id || loadedYears[0]?.id || '';
      const nextYearId = hasStored ? (stored as string) : fallback;

      setSelectedYearIdState(nextYearId);
      if (typeof window !== 'undefined' && nextYearId) {
        localStorage.setItem(getStorageKey(schoolId), nextYearId);
      }
    } catch (error) {
      console.error('Erreur chargement années scolaires:', error);
      setYears([]);
      setSelectedYearIdState('');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    refreshYears();
  }, [refreshYears]);

  const selectedYear = useMemo(
    () => years.find((y) => y.id === selectedYearId) || null,
    [years, selectedYearId]
  );

  const value = useMemo(
    () => ({
      years,
      selectedYearId,
      selectedYear,
      isLoading,
      setSelectedYearId,
      refreshYears,
    }),
    [years, selectedYearId, selectedYear, isLoading, setSelectedYearId, refreshYears]
  );

  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
}

export function useSchoolYear() {
  const context = useContext(SchoolYearContext);
  if (!context) {
    throw new Error('useSchoolYear doit etre utilise dans SchoolYearProvider');
  }
  return context;
}
