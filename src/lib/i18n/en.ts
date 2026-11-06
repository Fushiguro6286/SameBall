// All UI text lives here so Hindi (P2) is a translation job, not a refactor.

export const en = {
  appName: "SameBall",
  tagline: "The group chat that never spoils the match.",
  pitch: "Every chat app races to deliver messages faster. We deliver them at the right moment.",

  landing: {
    heroTitle: "Your squad. Your feed. Zero spoilers.",
    heroBody:
      "Friends watch the same match on TV, streaming, radio or at the ground, all seconds apart. SameBall holds each message until that moment reaches your screen.",
    createRoom: "Create a room",
    tryIt: "Try it in 30 seconds",
    howTitle: "How it works",
    steps: [
      { title: "Make a room", body: "Name your match and share the link. No sign-up." },
      { title: "Pick your feed", body: "TV, streaming, radio, at the venue. Fine-tune in seconds." },
      { title: "Chat spoiler-free", body: "Messages from friends ahead of you unlock when your screen catches up." },
    ],
    myRooms: "My rooms",
    phoneFast: "📺 TV · live",
    phoneSlow: "📱 Streaming · +4s",
    heroMsg: "SIX!! 🔥🔥",
    heroUnlocks: "unlocks in",
    privacy: "Privacy",
    stats: "Live stats",
  },

  profile: {
    nameLabel: "Your name",
    namePlaceholder: "e.g. Asha",
    avatarLabel: "Pick an avatar",
  },

  create: {
    title: "Create a match room",
    roomNameLabel: "Room name",
    roomNamePlaceholder: "Thunder vs Rockets · Final",
    sportLabel: "Sport",
    submit: "Create room",
    creating: "Creating…",
  },

  sports: { cricket: "Cricket", football: "Football", f1: "F1", esports: "Esports", other: "Other" } as Record<string, string>,

  join: {
    title: (room: string) => `Join ${room}`,
    subtitle: "Pick a name and avatar. No sign-up.",
    submit: "Join room",
    joining: "Joining…",
    redirected: (name: string) => `The room was full, so you're in ${name}.`,
  },

  room: {
    lagBadge: (s: number) => (s === 0 ? "Live" : `+${s}s`),
    lagButtonLabel: "Set your feed delay",
    menu: "Room menu",
    revealAll: "Reveal all",
    revealAllConfirm: "Show every locked message now? You may get spoiled.",
    invite: "Invite",
    leaveHome: "Home",
    placeholder: "Message your squad…",
    send: "Send",
    sendFailed: "Not sent.",
    quickChat: "Quick chat",
    retry: "Retry",
    lockedBy: (name: string) => `Message from ${name}, locked`,
    unlocksIn: (s: number) => (s >= 60 ? `unlocks in ${Math.floor(s / 60)}m ${s % 60}s` : `unlocks in ${s}s`),
    spoilPrompt: "Spoil me?",
    spoilConfirm: "Show it",
    spoilCancel: "Keep it locked",
    spoiled: "spoiled",
    you: "You",
    titleCounts: (newCount: number, locked: number) =>
      [newCount ? `${newCount} new` : "", locked ? `${locked} locked` : ""].filter(Boolean).join(" · "),
    loading: "Loading room…",
    notFound: "This room doesn't exist. Check the link or create a new room.",
  },

  empty: {
    title: "Invite your squad",
    body: "Share the link. Everyone sets their own feed delay, and nobody gets spoiled.",
    share: "Share",
    copy: "Copy link",
    copied: "Copied!",
    qr: "Show QR",
    hideQr: "Hide QR",
    shareText: (room: string) => `Join my spoiler-free match room: ${room}`,
  },

  conn: {
    connecting: "Connecting…",
    reconnecting: "Reconnecting… messages will catch up.",
    offline: "You're offline. We'll reconnect when you're back.",
    failed: "Couldn't connect to chat.",
    retry: "Retry",
    demo: "DEMO MODE · local tabs only, not Nexconn",
  },

  roar: {
    label: "Hold to roar",
    soundOn: "🔊 Tap to turn on stadium sound",
    sound: "Stadium sound",
    soundHelp: "The crowd roars on your phone when the moment reaches your screen.",
  },

  hype: {
    coming: (s: number) => `👀 something's coming in ${s}s`,
    comingSr: "Something's coming soon.",
    suspense: "Suspense mode",
    suspenseHelp: "Hype Radar pulses when your squad is reacting to a moment that hasn't reached your screen yet.",
  },

  lag: {
    title: "How are you watching?",
    subtitle: "Pick your feed. We hold messages until the moment reaches your screen.",
    sources: {
      tv: "TV",
      dth: "DTH",
      streaming: "Streaming app",
      web: "Web stream",
      radio: "Radio",
      venue: "At the venue",
      custom: "Custom",
    } as Record<string, string>,
    fineTune: "Fine-tune",
    seconds: (s: number) => `${s}s behind the fastest feed`,
    minus: "1 second less",
    plus: "1 second more",
    spoiled: "I got spoiled (+5s)",
    late: "Chat feels late (−3s)",
    done: "Done",
    close: "Close",
  },

  feedback: {
    question: "Did SameBall save you from a spoiler?",
    yes: "👍 Yes",
    no: "👎 No",
    commentPlaceholder: "Anything else? (optional)",
    send: "Send",
    thanks: "Thanks! That helps a lot.",
    dismiss: "Dismiss",
  },

  errors: {
    generic: "Something went wrong.",
    rate: "Too many tries. Wait a minute and try again.",
    name: "Please pick a different name.",
    chat: "Chat service is unavailable right now. Try again in a moment.",
    reload: "Reload",
    crashTitle: "Something broke.",
    crashBody: "We've logged it. Reloading usually fixes it.",
  },

  privacy: {
    title: "Privacy",
    intro: "SameBall is built to know as little about you as possible.",
    stored: [
      "A random guest id kept in your browser. No email, phone or password.",
      "The display name and emoji avatar you pick.",
      "Your feed delay (lag), sent with your messages so others' timing works.",
      "Anonymous usage events (for example: room created, message sent, spoiler blocked) to measure whether SameBall works.",
    ],
    chat: "Chat messages are delivered and stored by our chat provider, Nexconn, for up to 180 days.",
    deleteTitle: "Delete my data",
    deleteBody: "Removes your profile, room memberships, feedback and usage events from our database, and clears this browser.",
    deleteButton: "Delete my data",
    deleting: "Deleting…",
    deleted: "Done. Your data has been deleted.",
    nothing: "There's no SameBall data in this browser.",
  },

  stats: {
    title: "Live stats",
    subtitle: "Real usage. Test and bot users are excluded.",
    users: "Users connected",
    rooms: "Rooms",
    messages: "Messages",
    spoilersBlocked: "Spoilers blocked",
    roars: "Roars",
    spoilersHelp: "Messages that arrived locked and then revealed on schedule, not through spoil me.",
  },
};

export type Dict = typeof en;
