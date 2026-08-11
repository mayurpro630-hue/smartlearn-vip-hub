import { toast } from "sonner";

/** Copy text to the clipboard with a fallback for browsers/webviews
 *  that block the async Clipboard API. */
export async function copyText(text: string, successMessage = "Copied") {
  const value = text ?? "";
  if (!value.trim()) {
    toast.error("Nothing to copy");
    return false;
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    if (ok) {
      toast.success(successMessage);
      return true;
    }
  } catch {
    // ignore
  }
  toast.error("Copy blocked by your browser — long-press the text to select it");
  return false;
}
