"use client";

import { useEffect, useState } from "react";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "@/lib/theme";
import { BandProvider } from "./Band";
import { Shell } from "./Shell";
import { UiProvider } from "./ui";

export function Providers({ children }: { children: React.ReactNode }) {
  // Everything here is per-user data fetched in the browser, and the layout depends on
  // screen size, so render after mount to avoid server/client layout mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <UiProvider>
        <BandProvider>
          {mounted ? <Shell>{children}</Shell> : null}
        </BandProvider>
      </UiProvider>
    </ThemeProvider>
  );
}
