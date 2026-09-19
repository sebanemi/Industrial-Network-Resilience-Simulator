import { memo } from "react";

import { IconAlert, IconCheck, IconClose } from "./icons";
import { useUI } from "../state/ui";

function Toasts() {
  const { toasts, dismiss } = useUI();

  if (toasts.length === 0) return null;

  return (
    <div className="toasts">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          {t.type === "success" ? <IconCheck size={14} /> : t.type === "error" ? <IconAlert size={14} /> : <span className="toast-mark" />}
          <span>{t.message}</span>
          <IconClose size={12} />
        </button>
      ))}
    </div>
  );
}

export default memo(Toasts);