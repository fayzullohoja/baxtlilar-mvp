"use client";
import { useEffect, useRef } from "react";

// UX-DIALOG-A11Y: фокус-ловушка для модалок (Dialog/Drawer). При открытии
// фокусирует первый интерактивный элемент, зацикливает Tab внутри контейнера и
// ВОЗВРАЩАЕТ фокус на элемент-триггер при закрытии. Без этого клавиатурный юзер
// «проваливается» за модалку и теряет место.
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Начальный фокус: первый интерактивный, иначе сам контейнер.
    (focusables()[0] ?? node).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === first || activeEl === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      // Возврат фокуса на триггер (если он ещё в DOM).
      if (prevFocus && typeof prevFocus.focus === "function" && document.contains(prevFocus)) {
        prevFocus.focus();
      }
    };
  }, [active]);

  return ref;
}
