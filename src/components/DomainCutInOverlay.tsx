import React, { useEffect, useState } from 'react';
import { FIGHTER_BY_ID, type FighterId } from '../shared/gameData.ts';

export interface DomainCutInBanner {
  id: string;
  casterName: string;
  fighterId: FighterId;
  domainName: string;
  primaryHex: number;
  isClash?: boolean;
  challengerName?: string;
  challengerDomainName?: string;
}

interface DomainCutInOverlayProps {
  banner: DomainCutInBanner | null;
}

/**
 * Pre-mounted GPU-composited Jujutsu Shenanigans-style diagonal cut-in overlay.
 * Always stays mounted in the DOM (opacity-0 / pointer-events-none when idle)
 * so triggering Domain Expansion never allocates DOM nodes or drops frames.
 */
export const DomainCutInOverlay: React.FC<DomainCutInOverlayProps> = React.memo(({ banner }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!banner) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1650);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const fighter = banner ? FIGHTER_BY_ID[banner.fighterId] : FIGHTER_BY_ID.khen;
  const accentCss = banner
    ? `#${banner.primaryHex.toString(16).padStart(6, '0')}`
    : '#a855f7';

  return (
    <div
      data-testid="domain-cutin-overlay"
      aria-hidden={!visible}
      className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-200 ${
        visible && banner ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top & bottom solid architectural ink framing bands */}
      <div
        className={`absolute inset-x-0 top-0 h-16 sm:h-20 bg-slate-950 border-b-4 transition-transform duration-200 ${
          visible && banner ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ borderColor: accentCss }}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-16 sm:h-20 bg-slate-950 border-t-4 transition-transform duration-200 ${
          visible && banner ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ borderColor: accentCss }}
      />

      {/* Diagonal Manga Slanted Banner */}
      <div
        className={`relative w-[112%] -rotate-3 bg-slate-950/96 border-y-4 py-4 sm:py-6 px-6 shadow-2xl transition-transform duration-200 ${
          visible && banner ? 'translate-x-0 scale-100' : '-translate-x-12 scale-95'
        }`}
        style={{ borderColor: accentCss }}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2.5">
              <span
                className="font-display text-xs sm:text-sm font-black tracking-[0.28em] uppercase px-2 py-0.5 text-slate-950"
                style={{ backgroundColor: accentCss }}
              >
                {banner?.isClash ? 'DOMAIN CLASH' : 'DOMAIN EXPANSION'}
              </span>
              <span className="font-manga text-lg sm:text-2xl tracking-widest text-white/85">
                領域展開
              </span>
            </div>
            <div className="font-manga text-2xl sm:text-5xl tracking-wider text-white uppercase mt-1 drop-shadow">
              {banner?.domainName ?? ''}
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className="font-display text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300">
              {banner?.casterName ?? fighter.name}
            </div>
            {banner?.isClash && banner.challengerName && (
              <div className="font-manga text-base sm:text-xl text-rose-400 tracking-wider mt-0.5">
                VS {banner.challengerName} · {banner.challengerDomainName}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
