import { useEffect, useRef, useState } from "react";

// Shared counter so focused windows stay on top.
let globalZIndex = 100;

// Draggable and resizable window shell.
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
  // Current window position.
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });

  // Current window size.
  const [size, setSize] = useState({ w: defaultW, h: defaultH });

  // Keep latest size available inside mouse listeners.
  const sizeRef = useRef({ w: defaultW, h: defaultH });
  sizeRef.current = size;

  // Newer focus gets higher z-index.
  const [zIndex, setZIndex] = useState(() => ++globalZIndex);

  // Active drag/resize snapshot.
  const interaction = useRef(null);

  const bringToFront = () => {
    setZIndex(++globalZIndex);
  };

  // Start dragging.
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

  // Start resizing from bottom-right handle.
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

  // Track drag/resize even if cursor leaves the component.
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!interaction.current) return;

      const {
        type,
        startClientX,
        startClientY,
        startPosX,
        startPosY,
        startW,
        startH,
      } = interaction.current;

      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;

      if (type === "drag") {
        // Keep window inside app bounds.
        const LEFT_BOUND = 254;
        const TOP_BOUND = 48;
        const RIGHT_BOUND = window.innerWidth - sizeRef.current.w;
        const BOTTOM_BOUND = window.innerHeight - 44 - sizeRef.current.h;

        setPos({
          x: Math.min(Math.max(LEFT_BOUND, startPosX + dx), RIGHT_BOUND),
          y: Math.min(Math.max(TOP_BOUND, startPosY + dy), BOTTOM_BOUND),
        });
      } else if (type === "resize") {
        // Enforce minimum window size.
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

  // Keep state while minimized.
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
      <div className="dw-titlebar" onMouseDown={handleTitleMouseDown}>
        <span className="dw-title">{title}</span>

        <div className="dw-controls">
          <button
            className="dw-btn"
            title="Minimize to taskbar"
            onClick={(e) => {
              // Avoid starting drag when clicking controls.
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
