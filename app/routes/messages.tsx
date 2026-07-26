import { data, Link, useFetcher, useRevalidator } from "react-router";
import type { Route } from "./+types/messages";
import { getCurrentUser } from "../auth.server";
import { createMessage, deleteMessage, editMessage, findUserByUsername, getDialogMessages, markDialogNotificationsRead } from "../database.server";
import { isUserViewingDialog, publishUserEvent } from "../realtime.server";
import { Header } from "../components/header";
import { useLocalization } from "../localization";
import { useEffect, useRef, useState } from "react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  if (!user) throw new Response("Необходима авторизация", { status: 401 });
  const peer = findUserByUsername(params.username);
  if (!peer) throw new Response("Пользователь не найден", { status: 404 });
  return {
    user,
    peer: { id: peer.id, username: peer.username, avatarUrl: peer.avatarUrl, lastSeen: peer.lastSeen },
    messages: getDialogMessages(user.id, peer.id),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await getCurrentUser(request);
  if (!user) throw new Response("Необходима авторизация", { status: 401 });
  const peer = findUserByUsername(params.username);
  if (!peer) throw new Response("Пользователь не найден", { status: 404 });
  if (peer.id === user.id) return data({ error: "Нельзя написать самому себе." }, { status: 400 });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "send");
  if (intent === "read") {
    markDialogNotificationsRead(user.id, peer.id);
    return { error: null };
  }
  const messageId = Number(form.get("messageId"));
  if (intent === "delete") {
    if (!deleteMessage(messageId, user.id)) return data({ error: "Сообщение не найдено." }, { status: 404 });
    publishUserEvent(peer.id, { type: "message", peerId: user.id });
    return { error: null };
  }
  const content = String(form.get("content") ?? "").trim();
  if (content.length > 2000) return data({ error: "Сообщение не должно превышать 2000 символов." }, { status: 400 });
  if (intent === "edit") {
    if (!content) return data({ error: "Сообщение не может быть пустым." }, { status: 400 });
    if (!editMessage(messageId, user.id, content)) return data({ error: "Сообщение не найдено." }, { status: 404 });
    publishUserEvent(peer.id, { type: "message", peerId: user.id });
    return { error: null };
  }
  let imageUrl: string | null = null;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)) {
      return data({ error: "Поддерживаются изображения JPG, PNG, WebP и GIF." }, { status: 400 });
    }
    if (image.size > 5 * 1024 * 1024) return data({ error: "Изображение не должно превышать 5 МБ." }, { status: 400 });
    imageUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  }
  if (!content && !imageUrl) return data({ error: "Добавьте текст или изображение." }, { status: 400 });
  createMessage(user.id, peer.id, content, imageUrl, Number(form.get("replyToId")) || null, !isUserViewingDialog(peer.id, user.id));
  publishUserEvent(peer.id, { type: "message", peerId: user.id });
  return { error: null };
}

export default function Messages({ loaderData }: Route.ComponentProps) {
  const { text, language } = useLocalization();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<typeof action>();
  const readFetcher = useFetcher<typeof action>();
  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  type Message = (typeof loaderData.messages)[number];
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: Message; x: number; y: number } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    const events = new EventSource(`/events?peerId=${loaderData.peer.id}`);
    events.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { type?: string; peerId?: number };
      if (payload.type === "message" && payload.peerId === loaderData.peer.id) {
        revalidator.revalidate();
        readFetcher.submit({ intent: "read" }, { method: "post" });
      }
    };
    return () => events.close();
  }, [loaderData.peer.id]);

  useEffect(() => {
    readFetcher.submit({ intent: "read" }, { method: "post" });
  }, [loaderData.peer.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loaderData.messages.length]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && !fetcher.data.error) {
      formRef.current?.reset();
      setReplyTo(null);
      setEditing(null);
      setImagePreview(null);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
    };
  }, []);

  useEffect(() => {
    if (!viewingImage) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewingImage(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [viewingImage]);

  function revealMessage(messageId: number) {
    const target = document.getElementById(`message-${messageId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId((current) => current === messageId ? null : current), 2100);
  }

  return (
    <main className="chat-page">
      <Header />
      <section className="chat-shell">
        <Link className="chat-peer" to={`/users/${loaderData.peer.username}`}>
          {loaderData.peer.avatarUrl ? <img src={loaderData.peer.avatarUrl} alt="" /> : <span>{loaderData.peer.username[0].toUpperCase()}</span>}
          <div><h1>{loaderData.peer.username}</h1><small>{text("Последний онлайн", "Останній онлайн")}: {new Date(`${loaderData.peer.lastSeen}Z`).toLocaleString(language === "uk" ? "uk-UA" : "ru-RU")}</small></div>
        </Link>
        <div className="chat-messages">
          {loaderData.messages.length === 0 && <p className="chat-empty">{text("Начните диалог первым сообщением.", "Почніть діалог першим повідомленням.")}</p>}
          {loaderData.messages.map((message) => (
            <article
              id={`message-${message.id}`}
              className={`${message.senderId === loaderData.user.id ? "chat-message chat-message--own" : "chat-message"} ${highlightedMessageId === message.id ? "chat-message--highlighted" : ""}`}
              key={message.id}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ message, x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 170) });
              }}
            >
              {message.replyToId && <button className="chat-message__reply" type="button" onClick={() => revealMessage(message.replyToId!)}><strong>{message.replyUsername}</strong><span>{message.replyContent || (message.replyImageUrl ? text("Изображение", "Зображення") : text("Сообщение удалено", "Повідомлення видалено"))}</span></button>}
              {message.imageUrl && <button className="chat-message__image-button" type="button" onClick={() => setViewingImage(message.imageUrl)}><img className="chat-message__image" src={message.imageUrl} alt={text("Открыть изображение", "Відкрити зображення")} /></button>}
              {message.content && <p>{message.content}</p>}
              <time>{new Date(`${message.createdAt}Z`).toLocaleString(language === "uk" ? "uk-UA" : "ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</time>
              {message.editedAt && <small className="chat-message__edited">{text("изменено", "змінено")}</small>}
            </article>
          ))}
          <div ref={endRef} />
        </div>
        <fetcher.Form method="post" encType="multipart/form-data" className="chat-form" ref={formRef}>
          <input type="hidden" name="intent" value={editing ? "edit" : "send"} />
          <input type="hidden" name="messageId" value={editing?.id ?? ""} />
          <input type="hidden" name="replyToId" value={replyTo?.id ?? ""} />
          {(replyTo || editing) && <div className="chat-compose-context"><div><strong>{editing ? text("Редактирование", "Редагування") : text("Ответ", "Відповідь")}</strong><span>{(editing ?? replyTo)?.content || text("Изображение", "Зображення")}</span></div><button type="button" onClick={() => { setReplyTo(null); setEditing(null); }}>×</button></div>}
          {imagePreview && <div className="chat-image-preview"><img src={imagePreview} alt="" /><button type="button" onClick={() => {
            setImagePreview(null);
            const imageInput = formRef.current?.querySelector<HTMLInputElement>('input[name="image"]');
            if (imageInput) imageInput.value = "";
          }}>×</button></div>}
          <div className="chat-compose-row">
            {!editing && <label className="chat-image-button" title={text("Прикрепить изображение", "Прикріпити зображення")}><input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              setImagePreview(file ? URL.createObjectURL(file) : null);
            }} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 12.5 5.8-5.8a3.2 3.2 0 0 1 4.5 4.5l-8.1 8.1a5 5 0 0 1-7.1-7.1l8-8a2.8 2.8 0 0 1 4 4l-8 8a.9.9 0 0 1-1.3-1.3l7-7" /></svg></label>}
            <textarea key={editing?.id ?? "new"} name="content" rows={1} maxLength={2000} defaultValue={editing?.content ?? ""} placeholder={text("Сообщение…", "Повідомлення…")} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} />
            <button className="chat-send-button" type="submit" aria-label={editing ? text("Сохранить", "Зберегти") : text("Отправить", "Надіслати")}>
              {editing ? <span>✓</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" /></svg>}
            </button>
          </div>
          {fetcher.data?.error && <p className="form-error">{fetcher.data.error}</p>}
        </fetcher.Form>
      </section>
      {contextMenu && <div className="message-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => { setReplyTo(contextMenu.message); setEditing(null); setContextMenu(null); }}>{text("Ответить", "Відповісти")}</button>
        {contextMenu.message.senderId === loaderData.user.id && <>
          <button type="button" onClick={() => { setEditing(contextMenu.message); setReplyTo(null); setContextMenu(null); }}>{text("Редактировать", "Редагувати")}</button>
          <button className="message-context-menu__delete" type="button" onClick={() => {
            fetcher.submit({ intent: "delete", messageId: String(contextMenu.message.id) }, { method: "post" });
            setContextMenu(null);
          }}>{text("Удалить", "Видалити")}</button>
        </>}
      </div>}
      {viewingImage && <div className="chat-image-modal" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setViewingImage(null);
      }}>
        <section role="dialog" aria-modal="true" aria-label={text("Просмотр изображения", "Перегляд зображення")}>
          <button type="button" onClick={() => setViewingImage(null)} aria-label={text("Закрыть", "Закрити")}>×</button>
          <img src={viewingImage} alt="" />
        </section>
      </div>}
    </main>
  );
}
