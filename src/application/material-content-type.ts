export const detectActualContentType = async (file: File): Promise<string> =>
  detectActualContentTypeFromBytes(
    file.name,
    file.type,
    new Uint8Array(await file.arrayBuffer()),
  );

export const detectActualContentTypeFromBytes = async (
  name: string,
  declaredContentType: string,
  bytes: Uint8Array,
): Promise<string> => {
  const header = bytes.slice(0, 16);
  const ascii = new TextDecoder("latin1").decode(header);
  if (ascii.startsWith("%PDF")) return "application/pdf";
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return "image/png";
  }
  if (header[0] === 0xff && header[1] === 0xd8) return "image/jpeg";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii.startsWith("PK")) {
    const { default: JSZip } = await import("jszip");
    const archive = await JSZip.loadAsync(bytes);
    if (archive.file("word/document.xml")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (archive.file("ppt/presentation.xml")) {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    if (archive.file("xl/workbook.xml")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    return "application/zip";
  }
  const extension = name.split(".").at(-1)?.toLocaleLowerCase();
  if (extension === "csv") return "text/csv";
  if (extension === "md" || extension === "markdown") {
    return "text/markdown";
  }
  if (extension === "txt") return "text/plain";
  return declaredContentType || "application/octet-stream";
};
