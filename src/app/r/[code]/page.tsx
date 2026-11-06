import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ROOM_CODE_RE } from "@/lib/guard";
import { t } from "@/lib/i18n";
import { getRoom } from "@/lib/rooms";
import { RoomClient } from "./RoomClient";

const isDemo = (sp: Record<string, string | string[] | undefined>) => sp.demo === "1" && process.env.NODE_ENV !== "production";

export async function generateMetadata(props: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  const room = ROOM_CODE_RE.test(code) ? await getRoom(code).catch(() => null) : null;
  // Room names are user-typed and safe to show; messages never appear in metadata.
  return {
    title: room?.name ?? t.appName,
    description: "Join my spoiler-free match room.",
    robots: { index: false },
  };
}

export default function RoomPage(props: PageProps<"/r/[code]">) {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center text-muted">{t.room.loading}</main>}>
      <RoomLoader {...props} />
    </Suspense>
  );
}

async function RoomLoader(props: PageProps<"/r/[code]">) {
  const { code } = await props.params;
  const sp = await props.searchParams;
  if (isDemo(sp)) return <RoomClient code={code.toUpperCase()} roomName="Demo room" sport={typeof sp.sport === "string" ? sp.sport : "cricket"} demo />;
  if (!ROOM_CODE_RE.test(code)) notFound();
  const room = await getRoom(code);
  if (!room) notFound();
  return (
    <RoomClient
      code={room.code}
      roomName={room.name}
      sport={room.sport}
      kind={room.kind}
      startsAt={room.kind === "room" ? room.startsAt?.getTime() : undefined}
      ownerId={room.createdBy}
      demo={false}
    />
  );
}
