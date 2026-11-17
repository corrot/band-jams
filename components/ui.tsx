"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  SwipeableDrawer,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";

// ---------- toasts ----------

type Toast = { msg: string; severity: "success" | "error" | "info" };
const ToastCtx = createContext<(msg: string, severity?: Toast["severity"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

// ---------- confirm / prompt ----------

type ConfirmOpts = { title: string; body?: string; confirm?: string; danger?: boolean };
type PromptOpts = { title: string; label?: string; initial?: string; confirm?: string };
type DialogState =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOpts);

const DialogCtx = createContext<{
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
}>({ confirm: async () => false, prompt: async () => null });
export const useDialogs = () => useContext(DialogCtx);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [open, setOpen] = useState(false);
  const [dlg, setDlg] = useState<DialogState | null>(null);
  const [text, setText] = useState("");

  const show = useCallback((msg: string, severity: Toast["severity"] = "success") => {
    setToast({ msg, severity });
    setOpen(true);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ kind: "confirm", resolve, ...o })),
    [],
  );
  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setText(o.initial || "");
        setDlg({ kind: "prompt", resolve, ...o });
      }),
    [],
  );

  const close = (v: any) => {
    if (!dlg) return;
    (dlg.resolve as (x: any) => void)(v);
    setDlg(null);
  };

  return (
    <ToastCtx.Provider value={show}>
      <DialogCtx.Provider value={{ confirm, prompt }}>
        {children}
        <Snackbar
          open={open}
          autoHideDuration={3000}
          onClose={(_, r) => r !== "clickaway" && setOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity={toast?.severity || "success"} variant="filled" onClose={() => setOpen(false)} sx={{ width: "100%" }}>
            {toast?.msg}
          </Alert>
        </Snackbar>
        <Dialog open={!!dlg} onClose={() => close(dlg?.kind === "confirm" ? false : null)} fullWidth maxWidth="xs">
          {dlg && <DialogTitle>{dlg.title}</DialogTitle>}
          <DialogContent>
            {dlg?.kind === "confirm" && dlg.body && <DialogContentText>{dlg.body}</DialogContentText>}
            {dlg?.kind === "prompt" && (
              <TextField
                autoFocus
                margin="dense"
                label={dlg.label}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && close(text)}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button color="inherit" onClick={() => close(dlg?.kind === "confirm" ? false : null)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color={dlg?.kind === "confirm" && dlg.danger ? "error" : "primary"}
              onClick={() => close(dlg?.kind === "confirm" ? true : text)}
            >
              {dlg?.confirm || (dlg?.kind === "confirm" ? "OK" : "Save")}
            </Button>
          </DialogActions>
        </Dialog>
      </DialogCtx.Provider>
    </ToastCtx.Provider>
  );
}

// ---------- responsive sheet: bottom sheet on phones, dialog on larger screens ----------

export function useIsMobile() {
  const t = useTheme();
  return useMediaQuery(t.breakpoints.down("md"), { noSsr: true });
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "sm",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md";
}) {
  const mobile = useIsMobile();
  const header = (
    <Stack direction="row" sx={{ alignItems: "center", px: 2.5, pt: mobile ? 1 : 2, pb: 1 }}>
      <Typography variant="h6" sx={{ flex: 1 }}>
        {title}
      </Typography>
      <IconButton edge="end" onClick={onClose} aria-label="Close">
        <CloseRounded />
      </IconButton>
    </Stack>
  );
  const body = <Box sx={{ px: 2.5, pb: 2, overflowY: "auto", flex: 1 }}>{children}</Box>;
  const footer = actions && (
    <Stack
      direction="row"
      spacing={1}
     
      sx={{ justifyContent: "flex-end", px: 2.5, pt: 1.5, pb: mobile ? "calc(16px + env(safe-area-inset-bottom))" : 2, borderTop: 1, borderColor: "divider" }}
    >
      {actions}
    </Stack>
  );

  if (mobile)
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              maxHeight: "92dvh",
              display: "flex",
              flexDirection: "column",
              pb: actions ? 0 : "env(safe-area-inset-bottom)",
            },
          },
        }}
      >
        <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: "text.disabled", opacity: 0.5, mx: "auto", mt: 1 }} />
        {header}
        {body}
        {footer}
      </SwipeableDrawer>
    );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} scroll="paper">
      {header}
      {body}
      {footer}
    </Dialog>
  );
}

/** Hidden file input + trigger helper. */
export function useFilePicker(accept: string, multiple: boolean, onFiles: (f: File[]) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      hidden
      onChange={(e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (files.length) onFiles(files);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center", py: 6, px: 2, color: "text.secondary" }}>
      <Box sx={{ fontSize: 44, lineHeight: 1, color: "text.disabled", "& svg": { fontSize: 44 } }}>{icon}</Box>
      <Typography variant="subtitle1" color="text.primary">
        {title}
      </Typography>
      {body && (
        <Typography variant="body2" sx={{ maxWidth: 360 }}>
          {body}
        </Typography>
      )}
      {action}
    </Stack>
  );
}
