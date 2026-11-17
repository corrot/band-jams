"use client";

import { useRouter } from "next/navigation";
import { Box, Card, CardActionArea, Chip, Skeleton, Stack, Typography } from "@mui/material";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { Avatar, useBand } from "@/components/Band";
import { Page, PageBar } from "@/components/Shell";
import { useIsMobile } from "@/components/ui";

export default function MembersPage() {
  const { members, me } = useBand();
  const router = useRouter();
  const mobile = useIsMobile();
  return (
    <>
      <PageBar title="The band" subtitle={members.length ? `${members.length} member${members.length === 1 ? "" : "s"}` : undefined} />
      <Page narrow>
        {!mobile && (
          <Typography variant="h1" sx={{ mb: 2 }}>
            The band
          </Typography>
        )}
        <Stack spacing={1.25}>
          {members.length === 0 &&
            [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={88} />)}
          {members.map((m) => (
            <Card key={m.id}>
              <CardActionArea onClick={() => router.push(`/members/${m.id}`)} sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Avatar member={m} size={52} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="subtitle1" sx={{ color: m.color }} noWrap>
                        {m.name}
                      </Typography>
                      {me?.id === m.id && <Chip label="You" size="small" sx={{ height: 20 }} />}
                    </Stack>
                    {m.bio && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {m.bio}
                      </Typography>
                    )}
                    {!!m.instruments?.length && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, overflow: "hidden" }}>
                        {m.instruments.slice(0, 4).map((i) => (
                          <Chip key={i.id} label={i.name} size="small" variant="outlined" sx={{ height: 22, flexShrink: 0 }} />
                        ))}
                        {m.instruments.length > 4 && <Chip label={`+${m.instruments.length - 4}`} size="small" sx={{ height: 22 }} />}
                      </Stack>
                    )}
                  </Box>
                  <ChevronRightRounded color="disabled" />
                </Stack>
              </CardActionArea>
            </Card>
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, pt: 1 }}>
            New members join from the login screen with the band password.
          </Typography>
        </Stack>
      </Page>
    </>
  );
}
