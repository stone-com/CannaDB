import { useEffect, useRef, useState } from "react";

// Module-level counter — shared across all instances.
// Each window gets the next highest value so newly focused windows render on top.
let globalZIndex = 100;

// Floating, draggable, resizable window shell.
//
// Drag / resize mechanic:
//   1. On mousedown: snapshot cursor position + window position/size.
//   2. On mousemove: compute (dx, dy) from snapshot, apply to state.
//   3. On mouseup: clear snapshot.
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
  // Top-left corner position (CSS left / top).
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });

  // Current window dimensions (CSS width / height).
  const [size, setSize] = useState({ w: defaultW, h: defaultH });

  // Ref mirrors size so the mousemove closure always reads the latest value.
  const sizeRef = useRef({ w: defaultW, h: defaultH });
  sizeRef.current = size;

  // Each window gets an incrementing z-index so new windows open on top.
  const [zIndex, setZIndex] = useState(() => ++globalZIndex);

  // Snapshot of cursor + window state captured at the start of a drag/resize.
  const interaction = useRef(null);

  const bringToFront = () => {
    setZIndex(++globalZIndex);
  };

  // Starts a drag: snapshot cursor position and window position.
  const handleTitleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    bringToFront();

    interaction.current = {
      type: "drag",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  };

  // ── handleResizeMouseDown ───────────────────────────────────────────────────
  // Fires when the user presses the mouse button on the resize grip (bottom-right).
  // This is how resizing starts.
  // Starts a resize: snapshot cursor position and current size.
  const handleResizeMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    interaction.current = {
      type: "resize",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startW: size.w,
      startH: size.h,
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
      interaction.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // State is preserved while minimized — window restores to exact position/size.
  if (isMinimized) return null;

  return (
    <div
      className="dw-window"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex,
      }}
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

      <div className="dw-body">{children}</div>

      <div className="dw-resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
