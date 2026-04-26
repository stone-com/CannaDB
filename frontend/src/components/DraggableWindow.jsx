import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// globalZIndex lives OUTSIDE the component so it persists across all instances.
// Every time a window is clicked or opened, we increment this number and assign
// it as that window's z-index CSS value. A higher z-index = drawn on top.
// Starting at 100 keeps it safely above normal page content.
// ─────────────────────────────────────────────────────────────────────────────
let globalZIndex = 100;

// ─────────────────────────────────────────────────────────────────────────────
// DraggableWindow — a floating, draggable, resizable pop-out window.
//
// How drag & resize work (the core idea):
//   1. When the user presses the mouse button down, we remember:
//        - WHERE the cursor was at that moment (startClientX / startClientY)
//        - WHERE the window was at that moment (startPosX / startPosY for drag,
//          or startW / startH for resize)
//   2. As the mouse moves, we calculate how far it has traveled from the
//      start point (dx, dy). We add that distance to the original position
//      to get the new position. This makes movement feel 1:1 with the cursor.
//   3. When the mouse button is released, we clear the saved start data so
//      nothing moves anymore until the next press.
//
// Props this component accepts:
//   title        – text shown in the title bar (e.g. "Strains (12)")
//   onClose      – function to call when the ✕ button is clicked
//   isMinimized  – controlled from App.jsx; when true the window renders nothing
//                  and a taskbar tab appears instead (Windows-style minimize)
//   onMinimize   – function to call when the ▼ button is clicked; App.jsx sets
//                  isMinimized to true and adds a tab to the taskbar
//   children     – whatever JSX you put between <DraggableWindow>...</DraggableWindow>
//   defaultX     – starting left position in pixels (default 120)
//   defaultY     – starting top position in pixels (default 120)
//   defaultW     – starting width in pixels (default 540)
//   defaultH     – starting height in pixels (default 460)
// ─────────────────────────────────────────────────────────────────────────────
export default function DraggableWindow({
  title,
  onClose,
  isMinimized = false,
  onMinimize,
  children,
  defaultX = 120,
  defaultY = 120,
  defaultW = 540,
  defaultH = 460,
}) {
  // pos tracks the window's top-left corner on the screen.
  // We pass these as CSS `left` and `top` on the outer div.
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });

  // size tracks the current width and height of the window.
  // We pass these as CSS `width` and `height` on the outer div.
  const [size, setSize] = useState({ w: defaultW, h: defaultH });

  // sizeRef mirrors the `size` state so that the mousemove handler
  // (registered once in useEffect) always reads the CURRENT size, not the
  // stale value captured when the effect first ran.
  const sizeRef = useRef({ w: defaultW, h: defaultH });
  sizeRef.current = size;

  // zIndex controls which window appears in front when windows overlap.
  // We initialize it by immediately incrementing the global counter so each
  // new window opens on top of all previously opened ones.
  const [zIndex, setZIndex] = useState(() => ++globalZIndex);

  // interaction is a ref (not state) because we don't need React to re-render
  // when it changes — we just need to read it inside the mousemove handler.
  // It holds all the "snapshot" data from when the mouse button was pressed:
  //   { type: 'drag' | 'resize', startClientX, startClientY, ... }
  // When no interaction is happening, it's null.
  const interaction = useRef(null);

  // ── bringToFront ────────────────────────────────────────────────────────────
  // Called any time this window is clicked. Increments the global counter and
  // assigns the new highest value to this window, so it renders above all others.
  const bringToFront = () => {
    setZIndex(++globalZIndex);
  };

  // ── handleTitleMouseDown ────────────────────────────────────────────────────
  // Fires when the user presses the mouse button on the title bar.
  // This is how dragging starts.
  const handleTitleMouseDown = (e) => {
    // Only respond to the left mouse button (button 0).
    // Ignore right-click (2) or middle-click (1).
    if (e.button !== 0) return;

    // Prevent the browser's default text-selection behavior while dragging.
    e.preventDefault();

    // Raise this window above all others immediately on grab.
    bringToFront();

    // Snapshot the cursor's current position AND the window's current position.
    // We'll use these in onMouseMove to calculate how far things have moved.
    interaction.current = {
      type: "drag",
      startClientX: e.clientX, // cursor X when mouse was pressed
      startClientY: e.clientY, // cursor Y when mouse was pressed
      startPosX: pos.x, // window's left edge when mouse was pressed
      startPosY: pos.y, // window's top edge when mouse was pressed
    };
  };

  // ── handleResizeMouseDown ───────────────────────────────────────────────────
  // Fires when the user presses the mouse button on the resize grip (bottom-right).
  // This is how resizing starts.
  const handleResizeMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    // stopPropagation prevents this click from also triggering bringToFront
    // on the parent div (it would fire twice otherwise).
    e.stopPropagation();

    // Snapshot the cursor position AND the window's current size.
    interaction.current = {
      type: "resize",
      startClientX: e.clientX, // cursor X when resize started
      startClientY: e.clientY, // cursor Y when resize started
      startW: size.w, // window width when resize started
      startH: size.h, // window height when resize started
    };
  };

  // ── useEffect: global mousemove + mouseup listeners ────────────────────────
  // We attach these to `window` (the whole browser window), not just this div.
  // Why? Because if the user moves the mouse quickly, the cursor can leave the
  // window's div entirely — but we still want dragging/resizing to continue.
  // Attaching to `window` ensures we always catch the mouse movement.
  useEffect(() => {
    const onMouseMove = (e) => {
      // If no interaction is active (user isn't dragging or resizing), do nothing.
      if (!interaction.current) return;

      // Pull out everything we saved when the mouse button was pressed.
      const {
        type,
        startClientX,
        startClientY,
        startPosX,
        startPosY,
        startW,
        startH,
      } = interaction.current;

      // Calculate how far the cursor has moved since the interaction started.
      // dx = horizontal distance, dy = vertical distance.
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;

      if (type === "drag") {
        // Keep the window inside the visible workspace area:
        //   LEFT   — 254px: sidebar (220px) + 1px border + 3px gap + 30px adjustment
        //   TOP    — 48px:  height of the top header bar
        //   RIGHT  — screen width minus the window's own width
        //   BOTTOM — screen height minus taskbar (44px) and window height
        // sizeRef.current is used instead of `size` so this closure (created
        // once on mount) always sees the latest dimensions after a resize.
        const LEFT_BOUND = 254;
        const TOP_BOUND = 48;
        const RIGHT_BOUND = window.innerWidth - sizeRef.current.w;
        const BOTTOM_BOUND = window.innerHeight - 44 - sizeRef.current.h;

        setPos({
          x: Math.min(Math.max(LEFT_BOUND, startPosX + dx), RIGHT_BOUND),
          y: Math.min(Math.max(TOP_BOUND, startPosY + dy), BOTTOM_BOUND),
        });
      } else if (type === "resize") {
        // Grow or shrink the window by the same amount the cursor moved.
        // Math.max enforces minimum sizes so the window can't collapse to nothing:
        //   width minimum:  300px
        //   height minimum: 200px
        setSize({
          w: Math.max(300, startW + dx),
          h: Math.max(200, startH + dy),
        });
      }
    };

    const onMouseUp = () => {
      // The user released the mouse button — interaction is over.
      // Setting to null means onMouseMove will do nothing until the next press.
      interaction.current = null;
    };

    // Attach both listeners to the whole browser window.
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Cleanup function: React runs this when the component is removed from the
    // page (unmounted). Removing stale listeners prevents memory leaks and
    // phantom events from windows that no longer exist.
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []); // Empty array = run once when the component first appears, never again.

  // All hooks have been called above — safe to do an early return now.
  // When isMinimized is true, render nothing — the window vanishes from screen.
  // Crucially, the component stays MOUNTED (React doesn't destroy it), so pos,
  // size, and zIndex are all remembered. When restored, the window reappears
  // exactly where/how the user last left it.
  if (isMinimized) return null;

  // ── JSX (what actually renders on screen) ──────────────────────────────────
  return (
    // The outer div IS the window. position: fixed in CSS keeps it floating
    // over the page regardless of scroll. We set left/top/width/height via
    // inline styles so they update in real-time as the user drags/resizes.
    <div
      className="dw-window"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex,
      }}
      // Clicking anywhere on the window (even the body) brings it to the front.
      onMouseDown={bringToFront}
    >
      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      {/* The title bar listens for mousedown to start a drag. */}
      <div className="dw-titlebar" onMouseDown={handleTitleMouseDown}>
        {/* The window's name, e.g. "Strains (12)" */}
        <span className="dw-title">{title}</span>

        {/* Control buttons on the right side of the title bar */}
        <div className="dw-controls">
          {/* Minimize button — sends the window to the taskbar (Windows-style). */}
          {/* onMinimize is called in App.jsx, which sets isMinimized=true and  */}
          {/* adds a tab to the bottom taskbar. The window re-opens when that   */}
          {/* tab is clicked. */}
          <button
            className="dw-btn"
            title="Minimize to taskbar"
            onClick={(e) => {
              // stopPropagation prevents the click from also triggering
              // handleTitleMouseDown (which would start a drag unintentionally).
              e.stopPropagation();
              onMinimize();
            }}
          >
            ▼
          </button>

          {/* Close button — calls the onClose prop passed in from App.jsx,
              which unchecks the corresponding checkbox and removes this window. */}
          <button
            className="dw-btn dw-btn-close"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Window body ────────────────────────────────────────────────────── */}
      {/* The content (children) is whatever was placed between              */}
      {/* <DraggableWindow>...</DraggableWindow> in App.jsx.                 */}
      <div className="dw-body">{children}</div>

      {/* ── Resize handle ──────────────────────────────────────────────────── */}
      {/* A small div in the bottom-right corner styled as a diagonal grip. */}
      <div className="dw-resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
