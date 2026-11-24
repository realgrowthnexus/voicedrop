"use client";
import { useEffect, useRef } from "react";

type Props = {
  /** Live analyser while audio plays (null = idle breathing line). */
  analyser: AnalyserNode | null;
  className?: string;
  /** 0..1 amplitude for the idle line. */
  idleAmp?: number;
};

/**
 * The brand's signature: one thin tungsten line. It draws itself in, breathes while idle and
 * becomes the real waveform of the voice while audio plays.
 */
export function VoiceLine({ analyser, className = "", idleAmp = 0.12 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(analyser);

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lamp = getComputedStyle(el).getPropertyValue("--lamp").trim() || "#ffb547";
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = el.getBoundingClientRect();
      w = r.width;
      h = r.height;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      // static (reduced-motion) lines must be redrawn after layout changes
      if (reduce && !analyserRef.current) requestAnimationFrame(frame);
    });
    ro.observe(el);

    const N = 160;
    const smooth = new Float32Array(N);
    let buf: Float32Array<ArrayBuffer> | null = null;
    const start = performance.now();
    let id = 0;

    function frame(now: number) {
      if (!ctx) return;
      const t = (now - start) / 1000;
      const drawIn = reduce ? 1 : Math.min(1, t / 1.4);
      const eased = 1 - Math.pow(1 - drawIn, 4);
      const a = analyserRef.current;
      if (a) {
        if (!buf || buf.length !== a.fftSize) buf = new Float32Array(new ArrayBuffer(a.fftSize * 4));
        a.getFloatTimeDomainData(buf);
      }
      for (let i = 0; i < N; i++) {
        const x = i / (N - 1);
        // soft envelope keeps the ends anchored to the baseline
        const env = Math.sin(Math.PI * x) ** 1.2;
        let target: number;
        if (a && buf) {
          const j = Math.floor(x * (buf.length - 1));
          target = buf[j] * 2.2 * env;
        } else {
          const breathe = reduce ? 1 : 0.75 + 0.25 * Math.sin(t * 1.3);
          target = idleAmp * breathe * env * (Math.sin(x * 9 + t * 1.6) * 0.6 + Math.sin(x * 23 - t * 2.3) * 0.25);
        }
        smooth[i] += (target - smooth[i]) * (reduce && !a ? 1 : a ? 0.45 : 0.12);
      }

      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;
      const amp = h * 0.42;
      const maxX = w * eased;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, maxX, h);
      ctx.clip();
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = lamp;
      ctx.shadowColor = lamp;
      ctx.shadowBlur = a ? 18 : 10;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * w;
        const y = mid - Math.max(-1, Math.min(1, smooth[i])) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = ((i - 1) / (N - 1)) * w;
          const py = mid - Math.max(-1, Math.min(1, smooth[i - 1])) * amp;
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        }
      }
      ctx.stroke();
      ctx.restore();
      if (!reduce || a) id = requestAnimationFrame(frame);
    }
    id = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [idleAmp, analyser]);

  return <canvas ref={canvas} className={`block h-full w-full ${className}`} aria-hidden />;
}

/** Connect an <audio> element to an AnalyserNode once (must be called from a user gesture). */
export function attachAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
  const w = window as unknown as { __vdAudio?: WeakMap<HTMLAudioElement, AnalyserNode>; __vdCtx?: AudioContext };
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    w.__vdCtx ??= new AC();
    w.__vdAudio ??= new WeakMap();
    const existing = w.__vdAudio.get(audio);
    if (existing) {
      void w.__vdCtx.resume();
      return existing;
    }
    const ctx = w.__vdCtx;
    const src = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    w.__vdAudio.set(audio, analyser);
    void ctx.resume();
    return analyser;
  } catch {
    return null;
  }
}
