import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import path from "node:path";
const assets = fileURLToPath(new URL("../assets/", import.meta.url));
const asset = (name) => path.join(assets, "certificate", name);
const pink = "#cb3068",
  navy = "#261144";
// Place the supplied photographs without redrawing or modifying the signatures.
function signature(doc, file, crop, x, y, w, h) {
  const [left, top, width, height] = crop;
  const scale = Math.min(w / width, h / height);
  const dx = x + (w - width * scale) / 2,
    dy = y + (h - height * scale) / 2;
  doc
    .save()
    .rect(dx, dy, width * scale, height * scale)
    .clip();
  doc.image(asset(file), dx - left * scale, dy - top * scale, { scale });
  doc.restore();
}
function fitText(doc, value, font, maxSize, width) {
  doc.font(font);
  let size = maxSize;
  while (size > 8 && doc.fontSize(size).widthOfString(value) > width)
    size -= 0.5;
  return size;
}
export const DEFAULT_TEMPLATE = {
  heading: "CERTIFICATE",
  subheading: "OF APPRECIATION",
  presentedText: "This Certificate is proudly presented to",
  eventBody:
    "For contributing **{hours} volunteering {hoursLabel}** to **{event}**, completed on **{date}**. We appreciate their commitment and applaud their contribution to serve the society.",
  tenureBody:
    "from **{department} Department** for successfully completing **{months} {monthsLabel}** of volunteering ({start} – {end}) and earning **{rp} reward points**. We appreciate their commitment and applaud their contribution to serve the society.",
  manualBody:
    "from **{department} Department** for being the **{title}** of **{period}.** We appreciate their commitment and applaud their contribution to serve the society.",
};
const fill = (text, values) =>
  String(text || "").replace(/\{(\w+)\}/g, (m, key) =>
    values[key] == null ? "" : String(values[key]),
  );
const longDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "";
// Build the printable wording for an event certificate or a program certificate.
export function certificateContent(cert, template) {
  const program = !cert.event;
  const hours = cert.overrideHours ?? cert.hours;
  const months =
    cert.periodStart && cert.periodEnd
      ? Math.round(
          (new Date(cert.periodEnd) - new Date(cert.periodStart)) /
            (30.44 * 86400000),
        )
      : "";
  const values = {
    name: cert.displayName || cert.volunteer?.name || "",
    hours: hours ?? "",
    hoursLabel: hours === 1 ? "hour" : "hours",
    event: cert.overrideTitle || cert.event?.title || "",
    date: longDate(cert.event?.date),
    title: cert.title || "",
    department: (cert.department || "").replace(/\s+department$/i, ""),
    rp: cert.rp ?? "",
    months,
    monthsLabel: months === 1 ? "month" : "months",
    start: longDate(cert.periodStart),
    end: longDate(cert.periodEnd),
    period: cert.period || longDate(cert.periodEnd || cert.createdAt),
  };
  const body = program
    ? cert.description ||
      (cert.kind === "tenure" ? template.tenureBody : template.manualBody)
    : cert.description || template.eventBody;
  return {
    name: values.name,
    subject: program ? values.title : values.event,
    body: fill(body, values),
    certificateId: cert.certificateId,
  };
}
// Split "plain **bold** plain" into styled runs.
const runs = (text) =>
  String(text)
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
// Word-level layout: PDFKit cannot centre "continued" runs that mix fonts.
function layoutLines(doc, words, size, width) {
  const lines = [];
  let line = [],
    lineWidth = 0;
  for (const word of words) {
    const w = doc
      .font(word.bold ? "BodyBold" : "Body")
      .fontSize(size)
      .widthOfString(word.text);
    const gap = doc.font("Body").fontSize(size).widthOfString(" ");
    const space = line.length && !word.glue ? gap : 0;
    if (line.length && !word.glue && lineWidth + space + w > width) {
      lines.push({ words: line, width: lineWidth });
      line = [];
      lineWidth = 0;
    }
    const before = line.length && !word.glue ? gap : 0;
    line.push({ ...word, width: w, before });
    lineWidth += before + w;
  }
  if (line.length) lines.push({ words: line, width: lineWidth });
  return lines;
}
function richText(doc, text, x, y, width, maxHeight) {
  // "glue" marks a fragment that touches the previous one (e.g. "**points**.").
  const words = [];
  let space = true;
  for (const part of runs(text))
    for (const piece of part.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) space = true;
      else {
        words.push({ text: piece, bold: part.bold, glue: !space });
        space = false;
      }
    }
  let size = 15,
    lines = layoutLines(doc, words, size, width);
  while (size > 8 && lines.length * size * 1.55 > maxHeight) {
    size -= 0.5;
    lines = layoutLines(doc, words, size, width);
  }
  const lineHeight = size * 1.55;
  lines.forEach((line, row) => {
    let cursor = x + (width - line.width) / 2;
    for (const word of line.words) {
      cursor += word.before;
      doc
        .font(word.bold ? "BodyBold" : "Body")
        .fontSize(size)
        .fillColor("#111111")
        .text(word.text, cursor, y + row * lineHeight, { lineBreak: false });
      cursor += word.width;
    }
  });
}
export function createCertificateDocument(cert, custom = {}) {
  const template = { ...DEFAULT_TEMPLATE, ...custom };
  const content = certificateContent(cert, template);
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    info: {
      Title: `Certificate of Appreciation - ${content.name}`,
      Author: "Warriors Without Cause",
      Subject: content.subject,
    },
  });
  doc.registerFont(
    "Body",
    path.join(assets, "fonts", "Montserrat-Regular.ttf"),
  );
  doc.registerFont(
    "BodyBold",
    path.join(assets, "fonts", "Montserrat-Bold.ttf"),
  );
  doc.registerFont(
    "Recipient",
    path.join(assets, "fonts", "Lobster-Regular.ttf"),
  );
  const W = doc.page.width,
    H = doc.page.height;
  doc.rect(0, 0, W, H).fill("#ffffff");
  doc.rect(0, 0, 41, H).fill(pink);
  doc.rect(W - 41, 0, 41, H).fill(pink);
  // Gold ribbon and the original seal extracted from the supplied reference PDF.
  doc
    .save()
    .moveTo(91, 0)
    .lineTo(189, 0)
    .lineTo(189, 249)
    .lineTo(140, 213)
    .lineTo(91, 249)
    .closePath()
    .fill("#ffbd00")
    .restore();
  doc.image(asset("gold-seal.png"), 65, 42, { width: 150, height: 150 });
  doc
    .save()
    .circle(140, 117, 64)
    .clip()
    .image(asset("ngo-logo.jpeg"), 76, 53, { width: 128, height: 128 })
    .restore();
  doc
    .font("Times-Roman")
    .fontSize(60)
    .fillColor(pink)
    .text(template.heading || "CERTIFICATE", 260, 44, {
      width: 425,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Times-Bold")
    .fontSize(34)
    .fillColor("#000000")
    .text(template.subheading || "OF APPRECIATION", 258, 106, {
      width: 430,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Body")
    .fontSize(14)
    .text(template.presentedText || "", 260, 171, {
      width: 430,
      align: "center",
      lineBreak: false,
    });
  const name = content.name;
  const nameSize = fitText(doc, name, "Recipient", 54, 425);
  doc
    .font("Recipient")
    .fontSize(nameSize)
    .fillColor(pink)
    .text(name, 260, 201, {
      width: 430,
      height: 65,
      align: "center",
      lineBreak: false,
    });
  doc.moveTo(263, 276).lineTo(688, 276).lineWidth(1.5).stroke("#c69b58");
  doc.circle(263, 276, 2).fillAndStroke("#ffffff", "#c69b58");
  doc.circle(688, 276, 2).fillAndStroke("#ffffff", "#c69b58");
  richText(doc, content.body, 70, 296, W - 140, 100);
  // The latest supplied certificate image contains the approved, clearer signature row.
  // Clip the original photograph in the PDF; do not redraw signatures or alter their ink.
  signature(
    doc,
    "trustee-signatures-reference.png",
    [210, 966, 1590, 254],
    94,
    402,
    655,
    105,
  );
  doc
    .font("Body")
    .fontSize(13)
    .fillColor("#111111")
    .text(
      "Warriorswithoutcause NGO Registered under Indian Trusts Act, 1882",
      60,
      541,
      { width: W - 120, align: "center", lineBreak: false },
    );
  doc.text("Regd No. 2025/10/IV/232 IN BOOK NO IV, VOL NO. 5155", 60, 556, {
    width: W - 120,
    align: "center",
    lineBreak: false,
  });
  doc.text("NITI AAYOG UNIQUE ID: DL/00041884", 60, 571, {
    width: W - 120,
    align: "center",
    lineBreak: false,
  });
  // Keep the unique identifier readable without displacing the reference footer.
  doc
    .save()
    .rotate(-90, { origin: [29, H - 26] })
    .font("Body")
    .fontSize(6)
    .fillColor("#ffffff")
    .text(`Certificate ID: ${content.certificateId}`, 29, H - 26, {
      width: H - 52,
      lineBreak: false,
    })
    .restore();
  return doc;
}
