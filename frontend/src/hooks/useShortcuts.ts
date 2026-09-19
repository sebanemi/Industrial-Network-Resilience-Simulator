import { useEffect } from "react";

import { useApp } from "../state/store";
import { useUI } from "../state/ui";

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
};

/** Atajos de teclado globales (CAD):
 *  G → grilla · R → rangos · S → magnet · Esc → cancelar/seleccionar nada
 *  Supr/Backspace → eliminar nodo o forma seleccionado. */
export function useShortcuts() {
  const {
    state,
    toggleGrid,
    toggleRanges,
    toggleSnap,
    setAddType,
    setAddShapeType,
    select,
    selectShape,
    deleteNode,
    deleteShape,
  } = useApp();
  const { notify } = useUI();

  const { sim, selectedId, selectedShapeId } = state;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.key === "Escape") {
        setAddType(null);
        setAddShapeType(null);
        select(null);
        selectShape(null);
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "g") {
        toggleGrid();
        return;
      }
      if (k === "r") {
        toggleRanges();
        return;
      }
      if (k === "s") {
        toggleSnap();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedId) {
          void deleteNode(selectedId);
          notify(`Eliminado ${selectedId}`, "success");
          select(null);
        } else if (selectedShapeId) {
          void deleteShape(selectedShapeId);
          notify(`Eliminado ${selectedShapeId}`, "success");
          selectShape(null);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    sim,
    selectedId,
    selectedShapeId,
    toggleGrid,
    toggleRanges,
    toggleSnap,
    setAddType,
    setAddShapeType,
    select,
    selectShape,
    deleteNode,
    deleteShape,
    notify,
  ]);
}