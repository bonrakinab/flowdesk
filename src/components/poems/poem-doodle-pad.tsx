"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pen, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
};

export function PoemDoodlePad({ value, onChange, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [ink, setInk] = useState("#1c1917");
  const history = useRef<string[]>([]);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = Math.max(220, Math.round(w * 0.55));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // parchment fill
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(0, 0, w, h);
  }, []);

  const paintFromData = useCallback((dataUrl: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = "#f7f1e6";
    ctx.fillRect(0, 0, w, h);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = dataUrl;
  }, []);

  useEffect(() => {
    sizeCanvas();
    paintFromData(value);
    const onResize = () => {
      const snap = canvasRef.current?.toDataURL("image/png") || value;
      sizeCanvas();
      paintFromData(snap);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + value hydrate
  }, []);

  useEffect(() => {
    if (!drawing.current) paintFromData(value);
  }, [value, paintFromData]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    history.current.push(canvas.toDataURL("image/png"));
    if (history.current.length > 30) history.current.shift();
  }

  function commit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    drawing.current = true;
    last.current = pos(e);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    if (mode === "eraser") {
      ctx.strokeStyle = "#f7f1e6";
      ctx.lineWidth = 18;
    } else {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
    }
    ctx.stroke();
    last.current = p;
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    commit();
  }

  function undo() {
    const prev = history.current.pop();
    if (prev === undefined) {
      paintFromData(null);
      onChange(null);
      return;
    }
    paintFromData(prev);
    onChange(prev);
  }

  function clearAll() {
    pushHistory();
    paintFromData(null);
    onChange(null);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("pen")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
            mode === "pen"
              ? "bg-[#1c1917] text-[#fef3c7]"
              : "bg-[#e7e5e4] text-[#1c1917] hover:bg-[#d6d3d1]"
          )}
        >
          <Pen size={12} /> Pen
        </button>
        <button
          type="button"
          onClick={() => setMode("eraser")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
            mode === "eraser"
              ? "bg-[#1c1917] text-[#fef3c7]"
              : "bg-[#e7e5e4] text-[#1c1917] hover:bg-[#d6d3d1]"
          )}
        >
          <Eraser size={12} /> Eraser
        </button>
        <div className="flex items-center gap-1.5 pl-1">
          {["#1c1917", "#9f1239", "#0f766e", "#1d4ed8"].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Ink ${c}`}
              onClick={() => {
                setInk(c);
                setMode("pen");
              }}
              className={cn(
                "h-5 w-5 rounded-full border border-black/10",
                ink === c && mode === "pen" && "ring-2 ring-offset-1 ring-stone-800"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={undo}>
            <Undo2 size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-stone-400/30 shadow-inner">
        <canvas
          ref={canvasRef}
          className="touch-none block w-full cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="text-[11px]" style={{ color: "#57534e" }}>
        Doodle by hand when you don’t feel like typing — saved with this poem.
      </p>
    </div>
  );
}
