"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import LibraryMusicRounded from "@mui/icons-material/LibraryMusicRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { Avatar, Dock, useBand, useDock } from "./Band";
import { useIsMobile } from "./ui";

const NAV_H = 64;

function useSection() {
  const path = usePathname() || "/";
  const { me } = useBand();
  if (path.startsWith("/members/") && me && (path === `/members/${me.id}` || path === "/members/me")) return "me";
  if (path.startsWith("/members")) return "band";
  return "tracks";
}

/** App frame: bottom navigation + mini player on phones, top links on desktop. */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const mobile = useIsMobile();
  const section = useSection();
  const router = useRouter();
  const { me } = useBand();
  const dock = useDock();
  const login = path.startsWith("/login");
  const onTrack = path.startsWith("/tracks/");
  const showDock = !!dock.track && !onTrack && !login;
  const navH = mobile && !login ? NAV_H : 0;

  return (
    <>
      <Box
        component="main"
        sx={{
          minHeight: "100dvh",
          pb: login ? 0 : `calc(${navH + (showDock ? 72 : 0) + 24}px + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </Box>
      {showDock && <Dock bottom={`calc(${navH + 8}px + env(safe-area-inset-bottom))`} />}
      {mobile && !login && (
        <Paper
          elevation={0}
          sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1100, borderTop: 1, borderColor: "divider", pb: "env(safe-area-inset-bottom)", bgcolor: "transparent" }}
        >
          <BottomNavigation
            showLabels
            value={section}
            onChange={(_, v) => router.push(v === "tracks" ? "/" : v === "band" ? "/members" : `/members/${me?.id ?? "me"}`)}
          >
            <BottomNavigationAction value="tracks" label="Tracks" icon={<LibraryMusicRounded />} />
            <BottomNavigationAction value="band" label="Band" icon={<GroupsRounded />} />
            <BottomNavigationAction value="me" label="Me" icon={<Avatar member={me} size={26} />} />
          </BottomNavigation>
        </Paper>
      )}
    </>
  );
}

/** Sticky top bar for a page: back button, title, actions; desktop adds main navigation. */
export function PageBar({
  title,
  subtitle,
  back,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: string | boolean;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const mobile = useIsMobile();
  const section = useSection();
  const { me } = useBand();
  return (
    <AppBar position="sticky" sx={{ pt: "env(safe-area-inset-top)" }}>
      <Container maxWidth="lg" disableGutters>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, md: 64 }, px: { xs: 1, sm: 2 } }}>
          {back ? (
            <IconButton
              edge="start"
              aria-label="Back"
              onClick={() => (typeof back === "string" ? router.push(back) : window.history.length > 1 ? router.back() : router.push("/"))}
            >
              <ArrowBackRounded />
            </IconButton>
          ) : (
            !mobile && (
              <Stack component={Link} href="/" direction="row" spacing={1} sx={{ alignItems: "center", mr: 2, color: "inherit", textDecoration: "none" }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "primary.main", boxShadow: "0 0 12px #f5a524" }} />
                <Typography variant="h6" noWrap>
                  Band Jams
                </Typography>
              </Stack>
            )
          )}
          <Box sx={{ flex: 1, minWidth: 0, pl: back || mobile ? 0.5 : 0 }}>
            {(mobile || back) && (
              <>
                <Typography variant="h6" noWrap component="h1">
                  {title}
                </Typography>
                {subtitle && (
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {subtitle}
                  </Typography>
                )}
              </>
            )}
            {!mobile && !back && (
              <Stack direction="row" spacing={0.5}>
                <Button component={Link} href="/" color={section === "tracks" ? "primary" : "inherit"} startIcon={<LibraryMusicRounded />}>
                  Tracks
                </Button>
                <Button component={Link} href="/members" color={section === "band" ? "primary" : "inherit"} startIcon={<GroupsRounded />}>
                  Band
                </Button>
              </Stack>
            )}
          </Box>
          {actions}
          {!mobile && me && (
            <IconButton component={Link} href={`/members/${me.id}`} aria-label="My profile" sx={{ ml: 0.5 }}>
              <Avatar member={me} size={32} />
            </IconButton>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export function Page({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <Container maxWidth={narrow ? "md" : "lg"} sx={{ py: { xs: 2, md: 3 }, px: { xs: 1.5, sm: 3 } }}>
      {children}
    </Container>
  );
}
