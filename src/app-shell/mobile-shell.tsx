/**
 * app-shell/mobile-shell.tsx — Mobile-specific shell chrome.
 *
 * Renders the mobile top bar (hamburger, AI name, command palette trigger)
 * and the mobile drawer overlay. Desktop layout does not use this component.
 */

import type { ReactNode } from 'react';
import { List } from '@phosphor-icons/react/List';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { X } from '@phosphor-icons/react/X';

interface MobileHeaderProps {
  aiName: string;
  isMobileMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenCommandPalette: () => void;
  statusChips: ReactNode;
}

export function MobileHeader({
  aiName,
  isMobileMenuOpen,
  onToggleMenu,
  onOpenCommandPalette,
  statusChips,
}: MobileHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-30 px-4 py-3 bg-[#07090DF0] border-b border-border/50 backdrop-blur-xl safe-area-top">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleMenu}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-black/20 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? <X size={22} /> : <List size={22} />}
        </button>
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {aiName}
        </span>
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-black/20 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors"
          aria-label="Open command palette"
        >
          <MagnifyingGlass size={18} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5">
        {statusChips}
      </div>
    </div>
  );
}

interface MobileDrawerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawerOverlay({ isOpen, onClose }: MobileDrawerOverlayProps) {
  return (
    <div
      className={`drawer-overlay ${isOpen ? 'open' : ''}`}
      onClick={onClose}
    />
  );
}

interface MobileSidebarWrapperProps {
  isOpen: boolean;
  children: ReactNode;
}

export function MobileSidebarWrapper({ isOpen, children }: MobileSidebarWrapperProps) {
  return (
    <div className={`mobile-sidebar ${isOpen ? 'open' : ''}`}>
      {children}
    </div>
  );
}
