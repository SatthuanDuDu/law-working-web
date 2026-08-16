/** Load Noto Sans (Unicode / Vietnamese) into a jsPDF document. */

type JsPdfWithFont = {
  addFileToVFS: (filename: string, filebase64: string) => void;
  addFont: (
    postScriptName: string,
    id: string,
    fontStyle: string,
    fontWeight?: string | number,
  ) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
};

const FONT_FAMILY = "NotoSans";
const REGULAR_FILE = "NotoSans-Regular.ttf";
const BOLD_FILE = "NotoSans-Bold.ttf";

let fontCache: Promise<{ regular: string; bold: string }> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchFontBase64(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load PDF font: ${path} (${res.status})`);
  }
  return arrayBufferToBase64(await res.arrayBuffer());
}

function loadNotoSansBase64() {
  if (!fontCache) {
    fontCache = Promise.all([
      fetchFontBase64(`/fonts/${REGULAR_FILE}`),
      fetchFontBase64(`/fonts/${BOLD_FILE}`),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontCache;
}

/** Register NotoSans normal + bold on the document; returns family name. */
export async function ensurePdfUnicodeFont(
  doc: JsPdfWithFont,
): Promise<string> {
  const { regular, bold } = await loadNotoSansBase64();
  doc.addFileToVFS(REGULAR_FILE, regular);
  doc.addFileToVFS(BOLD_FILE, bold);
  doc.addFont(REGULAR_FILE, FONT_FAMILY, "normal");
  doc.addFont(BOLD_FILE, FONT_FAMILY, "bold");
  doc.setFont(FONT_FAMILY, "normal");
  return FONT_FAMILY;
}

export const PDF_UNICODE_FONT = FONT_FAMILY;
