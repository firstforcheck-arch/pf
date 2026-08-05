type RealtimeEvent = {
  type: "notification" | "message" | "presence";
  peerId?: number;
  userId?: number;
  online?: boolean;
  lastSeen?: string;
};

const subscribers = new Map<number, Set<(event: RealtimeEvent) => void>>();
const activeDialogs = new Map<string, number>();
const presenceSubscribers = new Map<number, Set<(event: RealtimeEvent) => void>>();

function publishPresence(userId: number, online: boolean) {
  const event: RealtimeEvent = { type: "presence", userId, online };
  if (!online) event.lastSeen = new Date().toISOString();
  presenceSubscribers.get(userId)?.forEach((send) => send(event));
}

export function publishUserEvent(userId: number, event: RealtimeEvent) {
  subscribers.get(userId)?.forEach((send) => send(event));
}

export function subscribeToUser(userId: number, send: (event: RealtimeEvent) => void, peerId?: number) {
  const userSubscribers = subscribers.get(userId) ?? new Set();
  const wasOffline = userSubscribers.size === 0;
  userSubscribers.add(send);
  subscribers.set(userId, userSubscribers);
  if (wasOffline) publishPresence(userId, true);
  const dialogKey = peerId ? `${userId}:${peerId}` : null;
  if (dialogKey) activeDialogs.set(dialogKey, (activeDialogs.get(dialogKey) ?? 0) + 1);
  return () => {
    userSubscribers.delete(send);
    if (userSubscribers.size === 0) {
      subscribers.delete(userId);
      publishPresence(userId, false);
    }
    if (dialogKey) {
      const remaining = (activeDialogs.get(dialogKey) ?? 1) - 1;
      if (remaining > 0) activeDialogs.set(dialogKey, remaining);
      else activeDialogs.delete(dialogKey);
    }
  };
}

export function isUserViewingDialog(userId: number, peerId: number) {
  return (activeDialogs.get(`${userId}:${peerId}`) ?? 0) > 0;
}

export function isUserOnline(userId: number) {
  return (subscribers.get(userId)?.size ?? 0) > 0;
}

export function subscribeToPresence(userId: number, send: (event: RealtimeEvent) => void) {
  const watchers = presenceSubscribers.get(userId) ?? new Set();
  watchers.add(send);
  presenceSubscribers.set(userId, watchers);
  send({ type: "presence", userId, online: isUserOnline(userId) });
  return () => {
    watchers.delete(send);
    if (watchers.size === 0) presenceSubscribers.delete(userId);
  };
}
