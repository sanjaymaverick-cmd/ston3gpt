"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, input, select, textarea, [role='button']";

export function MotionCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.classList.add("motion-cursor-enabled");

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let vx = 0;
    let vy = 0;
    let visible = false;
    let frame = 0;

    const tick = () => {
      const dx = targetX - x;
      const dy = targetY - y;
      vx = (vx + dx * 0.18) * 0.72;
      vy = (vy + dy * 0.18) * 0.72;
      x += vx;
      y += vy;

      const speed = Math.min(Math.hypot(vx, vy), 18);
      const angle = Math.atan2(vy, vx) * (180 / Math.PI);
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg) scale(${1 + speed * 0.018}, ${1 - speed * 0.01})`;
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!visible) {
        visible = true;
        x = targetX;
        y = targetY;
        dot.dataset.visible = "true";
        ring.dataset.visible = "true";
      }
    };

    const onOver = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest(INTERACTIVE);
      ring.dataset.hover = target ? "true" : "false";
    };

    const onDown = (event: PointerEvent) => {
      ring.dataset.pressed = "true";
      const impulse = document.createElement("span");
      impulse.className = "cursor-impulse";
      impulse.style.left = `${event.clientX}px`;
      impulse.style.top = `${event.clientY}px`;
      document.body.appendChild(impulse);
      impulse.addEventListener("animationend", () => impulse.remove(), { once: true });
    };

    const onUp = () => {
      ring.dataset.pressed = "false";
    };

    const onLeave = () => {
      visible = false;
      dot.dataset.visible = "false";
      ring.dataset.visible = "false";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("motion-cursor-enabled");
    };
  }, []);

  return (
    <div className="motion-cursor" aria-hidden="true">
      <div ref={ringRef} className="motion-cursor-ring" />
      <div ref={dotRef} className="motion-cursor-dot" />
    </div>
  );
}
