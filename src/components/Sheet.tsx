"use client";

import type { ReactNode } from "react";

/** Mobile bottom sheet with a dimmed backdrop. */
export function Sheet({
  children,
  onClose,
  labelledBy,
  z = 50,
}: {
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
  z?: number;
}) {
  return (
    <div className="fixed inset-0 flex items-end justify-center lg:items-center lg:p-8" style={{ zIndex: z }} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-md animate-sheet overflow-y-auto rounded-t-[2rem] bg-paper px-5 pb-8 pt-3 shadow-2xl lg:max-h-[88dvh] lg:max-w-2xl lg:rounded-[2rem] lg:px-8 lg:pt-6">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line lg:hidden" />
        {children}
      </div>
    </div>
  );
}
