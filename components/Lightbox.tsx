"use client";

import { useEffect, useRef } from "react";
import { Box, Dialog, IconButton, Stack, Typography } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";

export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: { url: string; caption?: string }[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const go = (d: number) => index !== null && onIndex((index + d + n) % n);

  useEffect(() => {
    if (index === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const img = index !== null ? images[index] : null;
  return (
    <Dialog fullScreen open={!!img} onClose={onClose} slotProps={{ paper: { sx: { bgcolor: "rgba(0,0,0,.96)", borderRadius: 0 } } }}>
      {img && (
        <Stack sx={{ height: "100%", pt: "env(safe-area-inset-top)", pb: "env(safe-area-inset-bottom)" }}>
          <Stack direction="row" sx={{ alignItems: "center", p: 1 }}>
            <Typography variant="body2" sx={{ flex: 1, px: 1 }} noWrap>
              {img.caption || ""} {n > 1 && <Box component="span" sx={{ color: "text.disabled" }}>({index! + 1}/{n})</Box>}
            </Typography>
            <IconButton component="a" href={img.url} target="_blank" rel="noreferrer" aria-label="Open full size">
              <OpenInNewRounded />
            </IconButton>
            <IconButton onClick={onClose} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
          <Box
            sx={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", position: "relative", touchAction: "pan-y pinch-zoom" }}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            <Box component="img" src={img.url} alt={img.caption || ""} sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            {n > 1 && (
              <>
                <IconButton onClick={() => go(-1)} aria-label="Previous" sx={{ position: "absolute", left: 8, bgcolor: "rgba(0,0,0,.5)" }}>
                  <ChevronLeftRounded />
                </IconButton>
                <IconButton onClick={() => go(1)} aria-label="Next" sx={{ position: "absolute", right: 8, bgcolor: "rgba(0,0,0,.5)" }}>
                  <ChevronRightRounded />
                </IconButton>
              </>
            )}
          </Box>
        </Stack>
      )}
    </Dialog>
  );
}
