'use client';

import React, { Suspense } from 'react';
import ForcePasswordChangeContent from './content';

export default function ForcePasswordChangePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ForcePasswordChangeContent />
    </Suspense>
  );
}
