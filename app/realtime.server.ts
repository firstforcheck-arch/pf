type RealtimeEvent = {
  type: "notification" | "message";
  peerId?: number;
};

const subscribers = new Map<number, Set<(event: RealtimeEvent) => void>>();
const activeDialogs = new Map<string, number>();

export function publishUserEvent(userId: number, event: RealtimeEvent) {
  subscribers.get(userId)?.forEach((send) => send(event));
}

export function subscribeToUser(userId: number, send: (event: RealtimeEvent) => void, peerId?: number) {
  const userSubscribers = subscribers.get(userId) ?? new Set();
  userSubscribers.add(send);
  subscribers.set(userId, userSubscribers);
  const dialogKey = peerId ? `${userId}:${peerId}` : null;
  if (dialogKey) activeDialogs.set(dialogKey, (activeDialogs.get(dialogKey) ?? 0) + 1);
  return () => {
    userSubscribers.delete(send);
    if (userSubscribers.size === 0) subscribers.delete(userId);
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
