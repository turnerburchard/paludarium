import { useEffect, useRef, type ReactNode } from "react";
interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
}
export function Modal({ label, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // A click that ends on the backdrop may have started inside the dialog,
  // like selecting a name and letting go outside, so only a press that
  // starts on the backdrop closes it.
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current!;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,a[href],[tabindex="0"]',
        ),
      );
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) =>
        (pressedBackdrop.current = e.target === e.currentTarget)
      }
      onClick={() => {
        if (pressedBackdrop.current) onClose();
      }}
    >
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
