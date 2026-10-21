import { useEffect } from 'react';

interface UseInknoteShortcutsOptions {
  onToggleCommandPalette: () => void;
  onEscape: () => void;
  onNewNote: () => void;
  onUndo: () => void;
  onRedo?: () => void;
  onOpenDailyJournal: () => void;
}

export function useInknoteShortcuts({
  onToggleCommandPalette,
  onEscape,
  onNewNote,
  onUndo,
  onRedo,
  onOpenDailyJournal,
}: UseInknoteShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      const modifier = event.ctrlKey || event.metaKey;

      // Escape always works anywhere to dismiss overlays
      if (event.key === 'Escape') {
        onEscape();
        return;
      }

      // Command palette shortcut (Cmd+K / Ctrl+K) works everywhere
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onToggleCommandPalette();
        return;
      }

      // Do not trigger global note editing shortcuts if user is typing in an editor/input
      if (isTyping) {
        return;
      }

      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onNewNote();
      } else if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo();
        }
      } else if (modifier && event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        onOpenDailyJournal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCommandPalette, onEscape, onNewNote, onUndo, onRedo, onOpenDailyJournal]);
}
