import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createCookieSessionStorage, redirect } from "react-router";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  canManageWork,
  touchUser,
  updateUserPassword,
} from "./database.server";
import { assertSameOrigin } from "./security.server";

const scrypt = promisify(scryptCallback);
const sessionSecret = process.env.SESSION_SECRET
  ?? (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("SESSION_SECRET must be configured in production"); })()
    : "development-only-change-this-secret");

const { getSession, commitSession, destroySession } = createCookieSessionStorage<{ userId: number; sessionVersion: number }>({
  cookie: {
    name: "__phantom_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function register(username: string, password: string) {
  return createUser(username, await hashPassword(password));
}

export async function authenticate(identifier: string, password: string) {
  const user = findUserByUsername(identifier) ?? findUserByEmail(identifier.toLowerCase());
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return user.id;
}

export async function verifyUserPassword(userId: number, password: string) {
  const user = findUserByUsername(findUserById(userId)?.username ?? "");
  return Boolean(user && await verifyPassword(password, user.passwordHash));
}

export async function changeUserPassword(userId: number, password: string) {
  updateUserPassword(userId, await hashPassword(password));
}

export async function getCurrentUser(request: Request) {
  assertSameOrigin(request);
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (!userId) return null;
  const user = findUserById(userId) ?? null;
  if (!user || session.get("sessionVersion") !== user.sessionVersion) return null;
  if (user) touchUser(user.id);
  return user;
}

export async function createUserSession(request: Request, userId: number, destination = "/") {
  const session = await getSession(request.headers.get("Cookie"));
  const user = findUserById(userId);
  if (!user) throw new Response("Пользователь не найден", { status: 404 });
  session.set("userId", userId);
  session.set("sessionVersion", user.sessionVersion);
  return redirect(destination, { headers: { "Set-Cookie": await commitSession(session) } });
}

export async function requireAdmin(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) throw redirect("/login");
  if (user.role !== "admin") throw new Response("Недостаточно прав", { status: 403 });
  return user;
}

export async function requireCreator(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) throw redirect("/login");
  return user;
}

export async function requireWorkManager(request: Request, workId: number) {
  const user = await requireCreator(request);
  if (!canManageWork(user, workId)) throw new Response("Недостаточно прав", { status: 403 });
  return user;
}

export async function logout(request: Request) {
  assertSameOrigin(request);
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/", { headers: { "Set-Cookie": await destroySession(session) } });
}
