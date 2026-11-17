"use client";

import { alpha, createTheme } from "@mui/material/styles";

const amber = "#f5a524";
const bg = "#0e0f12";
const paper = "#16181d";
const line = "#2a2e37";

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: amber, contrastText: "#1a1203" },
    secondary: { main: "#22d3ee" },
    error: { main: "#f2555a" },
    success: { main: "#3ccf91" },
    info: { main: "#7dd3fc" },
    background: { default: bg, paper },
    divider: line,
    text: { primary: "#ecebe6", secondary: "#9a9ca5", disabled: "#6b6e78" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontFamily: '"Space Grotesk", "Inter", sans-serif', fontWeight: 700, fontSize: "1.75rem", letterSpacing: "-0.01em" },
    h2: { fontFamily: '"Space Grotesk", "Inter", sans-serif', fontWeight: 700, fontSize: "1.4rem", letterSpacing: "-0.01em" },
    h3: { fontFamily: '"Space Grotesk", "Inter", sans-serif', fontWeight: 700, fontSize: "1.15rem" },
    h6: { fontFamily: '"Space Grotesk", "Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem" },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { letterSpacing: "0.08em", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitTapHighlightColor: "transparent", overscrollBehaviorY: "none" },
        "::selection": { background: alpha(amber, 0.35) },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, paddingInline: 16 }, sizeSmall: { paddingInline: 12 } },
    },
    MuiFab: { styleOverrides: { root: { textTransform: "none", fontWeight: 700 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderColor: line, backgroundColor: paper } },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: {
        root: {
          backgroundColor: alpha(bg, 0.82),
          backdropFilter: "saturate(160%) blur(14px)",
          borderBottom: `1px solid ${line}`,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: { root: { backgroundColor: alpha(paper, 0.94), backdropFilter: "blur(14px)", height: 64 } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: { root: { minWidth: 64, "&.Mui-selected": { color: amber } }, label: { fontWeight: 600 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, minHeight: 48 } } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: "none", borderRadius: 999 } } },
    MuiTextField: { defaultProps: { variant: "outlined", fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, backgroundColor: alpha("#fff", 0.03) } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20, backgroundColor: paper } } },
    MuiMenu: { styleOverrides: { paper: { border: `1px solid ${line}` } } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4 } } },
    MuiTooltip: { defaultProps: { enterTouchDelay: 400 } },
  },
});

export const STATUS_COLORS: Record<string, string> = {
  new: "#9aa3b5",
  shortlist: "#7dd3fc",
  working: amber,
  done: "#3ccf91",
  archived: "#6b6e78",
};
