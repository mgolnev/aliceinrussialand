"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bold, Check, Italic, Link2, Strikethrough, X } from "lucide-react";
import {
  editorHtmlToRichText,
  richTextToEditorHtml,
  safePostHref,
} from "@/lib/rich-text";
import {
  handleMobileEditableBlur,
  handleMobileEditableFocus,
} from "@/lib/mobile-editable-scroll";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
};

function selectionIsInside(root: HTMLElement) {
  const selection = window.getSelection();
  return Boolean(
    selection &&
      !selection.isCollapsed &&
      selection.rangeCount > 0 &&
      root.contains(selection.anchorNode) &&
      root.contains(selection.focusNode),
  );
}

export function RichTextEditor({ value, onChange, placeholder, disabled }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const savedRangeRef = useRef<Range | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("https://");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEmittedRef.current) return;
    editor.innerHTML = richTextToEditorHtml(value);
    lastEmittedRef.current = value;
  }, [value]);

  useEffect(() => {
    const updateSelection = () => {
      const editor = editorRef.current;
      setHasSelection(Boolean(editor && selectionIsInside(editor)));
    };
    document.addEventListener("selectionchange", updateSelection);
    return () => document.removeEventListener("selectionchange", updateSelection);
  }, []);

  function emitValue() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = editorHtmlToRichText(editor);
    lastEmittedRef.current = next;
    onChange(next);
  }

  function applyCommand(command: "bold" | "italic" | "strikeThrough") {
    const editor = editorRef.current;
    if (!editor || !selectionIsInside(editor)) {
      setHint("Сначала выделите фрагмент текста.");
      return;
    }
    document.execCommand(command);
    editor.focus();
    emitValue();
  }

  function openLinkDialog() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selectionIsInside(editor)) {
      setHint("Выделите текст, который нужно сделать ссылкой.");
      return;
    }
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    setLinkError(null);
    setLinkValue("https://");
    setLinkOpen(true);
  }

  function createLink() {
    const href = safePostHref(linkValue.trim());
    const editor = editorRef.current;
    if (!href) {
      setLinkError("Укажите полный адрес: https://…, http://… или mailto:…");
      return;
    }
    if (!editor || !savedRangeRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRangeRef.current);
    editor.focus();
    document.execCommand("createLink", false, href);
    emitValue();
    setLinkOpen(false);
    savedRangeRef.current = null;
  }

  const toolClass = "flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Текст публикации"
        data-placeholder={placeholder}
        className="rich-text-editor min-h-[120px] w-full whitespace-pre-wrap border-none bg-transparent p-0 text-base leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 sm:min-h-[160px] [&_a]:text-stone-900 [&_a]:underline [&_a]:decoration-stone-400 [&_a]:underline-offset-2"
        style={{ fontSize: "max(16px, 1rem)" }}
        dangerouslySetInnerHTML={{ __html: richTextToEditorHtml(value) }}
        onInput={emitValue}
        onFocus={(event) => {
          handleMobileEditableFocus(event);
          document.execCommand("defaultParagraphSeparator", false, "br");
        }}
        onBlur={handleMobileEditableBlur}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
      />

      <div className="mt-3 flex items-center gap-0.5 border-t border-stone-100 pt-2" role="toolbar" aria-label="Форматирование текста">
        <button type="button" className={`${toolClass} ${hasSelection ? "bg-stone-100" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand("bold")} disabled={disabled} aria-label="Жирный текст" title="Жирный"><Bold size={18} /></button>
        <button type="button" className={`${toolClass} ${hasSelection ? "bg-stone-100" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand("italic")} disabled={disabled} aria-label="Курсив" title="Курсив"><Italic size={18} /></button>
        <button type="button" className={`${toolClass} ${hasSelection ? "bg-stone-100" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyCommand("strikeThrough")} disabled={disabled} aria-label="Зачёркнутый текст" title="Зачёркнутый"><Strikethrough size={18} /></button>
        <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden />
        <button type="button" className={`${toolClass} ${hasSelection ? "bg-stone-100" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={openLinkDialog} disabled={disabled} aria-label="Вставить ссылку" title="Вставить ссылку"><Link2 size={18} /></button>
        {hint ? <span className="ml-2 text-xs text-stone-500" role="status">{hint}</span> : null}
      </div>

      {linkOpen ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2"
          onSubmit={(event) => { event.preventDefault(); createLink(); }}
          aria-label="Адрес ссылки"
        >
          <input autoFocus value={linkValue} onChange={(event) => setLinkValue(event.target.value)} className="min-w-[12rem] flex-1 bg-transparent px-1 py-1.5 text-sm outline-none" inputMode="url" aria-label="URL ссылки" />
          <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white active:scale-95" aria-label="Добавить ссылку"><Check size={16} /></button>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 active:scale-95" onClick={() => setLinkOpen(false)} aria-label="Отменить"><X size={16} /></button>
          {linkError ? <p className="w-full text-xs text-red-700" role="alert">{linkError}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
