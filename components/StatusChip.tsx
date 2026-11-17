"use client";

import { Chip } from "@mui/material";
import { STATUSES } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/theme";

export function StatusChip({ status, size = "small" }: { status: string; size?: "small" | "medium" }) {
  const label = STATUSES.find((s) => s.value === status)?.label || status;
  const c = STATUS_COLORS[status] || "#9aa3b5";
  return (
    <Chip
      label={label}
      size={size}
      variant="outlined"
      sx={{ color: c, borderColor: `${c}66`, bgcolor: status === "working" ? `${c}14` : "transparent", height: 22, fontSize: 12 }}
    />
  );
}

