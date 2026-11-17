"use client";

import { useEffect } from "react";

export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: { url: string; caption?: string }[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [index, images.length, onIndex, onClose]);
  const img = images[index];
  if (!img) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="lightbox" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={img.caption || ""} />
        <div className="row">
          {images.length > 1 && (
            <button className="btn sm" onClick={() => onIndex((index - 1 + images.length) % images.length)}>
              ←
            </button>
          )}
          <span className="small">
            {img.caption || ""} {images.length > 1 && <span className="faint">({index + 1}/{images.length})</span>}
          </span>
          {images.length > 1 && (
            <button className="btn sm" onClick={() => onIndex((index + 1) % images.length)}>
              →
            </button>
          )}
          <a className="btn sm" href={img.url} target="_blank" rel="noreferrer">
            Open full size
          </a>
          <button className="btn sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
