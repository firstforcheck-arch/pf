import { useRef, useState } from "react";

type Format = "bold" | "italic" | "underline" | "strike";
const formats: Record<Format, { tag: string; label: string; shortcut: string }> = {
  bold: { tag: "b", label: "B", shortcut: "Ctrl+B" },
  italic: { tag: "i", label: "I", shortcut: "Ctrl+I" },
  underline: { tag: "u", label: "U", shortcut: "Ctrl+U" },
  strike: { tag: "s", label: "S", shortcut: "Ctrl+Shift+X" },
};

function enclosingFormat(value: string, start: number, end: number, format: Format) {
  const tag = formats[format].tag;
  const opening = `[${tag}]`, closing = `[/${tag}]`;
  const openIndex = value.lastIndexOf(opening, start);
  const previousClose = value.lastIndexOf(closing, start);
  const closeIndex = value.indexOf(closing, end);
  return openIndex > previousClose && closeIndex >= end ? { openIndex, closeIndex } : null;
}

export function RichTextEditor({ value, onChange, name, rows = 28 }: { value: string; onChange: (value: string) => void; name: string; rows?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [toolbar, setToolbar] = useState({ left: 18, top: -48 });

  function updateSelection() {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return setSelection(null);
    setSelection({ start: textarea.selectionStart, end: textarea.selectionEnd });
    const length = Math.max(1, value.length);
    const approximateLine = value.slice(0, textarea.selectionStart).split("\n").length - 1;
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    setToolbar({
      left: Math.max(8, Math.min(textarea.clientWidth - 190, 18 + (textarea.selectionStart / length) * (textarea.clientWidth - 190))),
      top: Math.max(-48, approximateLine * lineHeight - textarea.scrollTop - 46),
    });
  }

  function applyFormat(format: Format) {
    const textarea = textareaRef.current;
    const range = textarea ? { start: textarea.selectionStart, end: textarea.selectionEnd } : selection;
    if (!textarea || !range || range.start === range.end) return;
    const tag = formats[format].tag;
    const opening = `[${tag}]`, closing = `[/${tag}]`;
    const selected = value.slice(range.start, range.end);
    const enclosing = enclosingFormat(value, range.start, range.end, format);
    const next = enclosing
      ? value.slice(0, enclosing.openIndex) + value.slice(enclosing.openIndex + opening.length, enclosing.closeIndex) + value.slice(enclosing.closeIndex + closing.length)
      : value.slice(0, range.start) + opening + selected + closing + value.slice(range.end);
    const nextStart = enclosing ? range.start - opening.length : range.start + opening.length;
    const nextEnd = nextStart + selected.length;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextStart, nextEnd);
      setSelection({ start: nextStart, end: nextEnd });
    });
  }

  return <div className="rich-text-editor">
    {selection && <div className="rich-text-toolbar" style={{ left: toolbar.left, top: toolbar.top }} role="toolbar" aria-label="Форматирование текста">
      {(Object.keys(formats) as Format[]).map((format) => {
        const pressed = Boolean(enclosingFormat(value, selection.start, selection.end, format));
        return <button key={format} type="button" className={`rich-text-toolbar__${format} ${pressed ? "active" : ""}`} aria-pressed={pressed} title={formats[format].shortcut} aria-label={`${format} (${formats[format].shortcut})`} onMouseDown={(event) => { event.preventDefault(); applyFormat(format); }}>{formats[format].label}</button>;
      })}
    </div>}
    <textarea id="chapter-content" ref={textareaRef} className="editor-form__content" name={name} rows={rows} value={value} onChange={(event) => onChange(event.currentTarget.value)} onSelect={updateSelection} onClick={updateSelection} onKeyUp={updateSelection} onScroll={updateSelection} onBlur={() => setSelection(null)} onKeyDown={(event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const format = key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : event.shiftKey && key === "x" ? "strike" : null;
      if (!format) return;
      event.preventDefault();
      applyFormat(format);
    }} />
  </div>;
}
