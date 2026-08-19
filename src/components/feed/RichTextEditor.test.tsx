import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";

function ControlledEditor() {
  const [value, setValue] = useState("");
  return <RichTextEditor value={value} onChange={setValue} placeholder="Текст" />;
}

describe("RichTextEditor", () => {
  it("keeps the native selection after the controlled value changes", () => {
    render(<ControlledEditor />);
    const editor = screen.getByRole("textbox", { name: "Текст публикации" });
    editor.textContent = "текст";

    const range = document.createRange();
    range.setStart(editor.firstChild!, 5);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    fireEvent.input(editor);

    expect(window.getSelection()?.focusNode).toBe(editor.firstChild);
    expect(window.getSelection()?.focusOffset).toBe(5);
  });

  it("sets left-to-right editing for Russian text", () => {
    render(<RichTextEditor value="Привет" onChange={() => {}} placeholder="Текст" />);
    const editor = screen.getByRole("textbox", { name: "Текст публикации" });
    expect(editor).toHaveAttribute("dir", "ltr");
    expect(editor).toHaveStyle({ unicodeBidi: "plaintext" });
  });

  it("does not pull the page back to the editor after it receives focus", () => {
    const originalExecCommand = document.execCommand;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(<RichTextEditor value="Привет" onChange={() => {}} placeholder="Текст" />);
    fireEvent.focus(screen.getByRole("textbox", { name: "Текст публикации" }));

    expect(scrollIntoView).not.toHaveBeenCalled();

    if (originalExecCommand) {
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: originalExecCommand,
      });
    } else {
      Reflect.deleteProperty(document, "execCommand");
    }
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});
