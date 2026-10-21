import { useState, useCallback, useRef } from 'react';
import { Workspace } from '../types/workspace';

export function useInknoteHistory(initialWorkspace: Workspace) {
  const [history, setHistory] = useState<Workspace[]>([]);
  const [future, setFuture] = useState<Workspace[]>([]);
  const lastSnapshotTimeRef = useRef<number>(0);

  const pushSnapshot = useCallback((state: Workspace, immediate = false) => {
    const now = Date.now();
    // If not immediate, debounce rapid continuous changes (e.g. typing) by 1 second
    if (!immediate && now - lastSnapshotTimeRef.current < 1000) {
      return;
    }
    lastSnapshotTimeRef.current = now;

    setHistory((prev) => [...prev.slice(-40), state]);
    setFuture([]); // Clear redo stack on new action
  }, []);

  const undo = useCallback(
    (currentState: Workspace, setWorkspace: (ws: Workspace) => void) => {
      setHistory((prev) => {
        if (prev.length === 0) return prev;
        const previousState = prev[prev.length - 1];
        setFuture((f) => [currentState, ...f]);
        setWorkspace(previousState);
        return prev.slice(0, -1);
      });
    },
    []
  );

  const redo = useCallback(
    (currentState: Workspace, setWorkspace: (ws: Workspace) => void) => {
      setFuture((prev) => {
        if (prev.length === 0) return prev;
        const nextState = prev[0];
        setHistory((h) => [...h, currentState]);
        setWorkspace(nextState);
        return prev.slice(1);
      });
    },
    []
  );

  const resetHistory = useCallback(() => {
    setHistory([]);
    setFuture([]);
  }, []);

  return {
    pushSnapshot,
    undo,
    redo,
    resetHistory,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}
