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
export function createCertificateDocument(cert) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    info: {
      Title: `Certificate of Appreciation - ${cert.volunteer.name}`,
      Author: "Warriors Without Cause",
      Subject: `${cert.event.title} - ${cert.hours} volunteering hours`,
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
    .text("CERTIFICATE", 260, 44, {
      width: 425,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Times-Bold")
    .fontSize(34)
    .fillColor("#000000")
    .text("OF APPRECIATION", 258, 106, {
      width: 430,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Body")
    .fontSize(14)
    .text("This Certificate is proudly presented to", 260, 171, {
      width: 430,
      align: "center",
      lineBreak: false,
    });
  const name = cert.volunteer.name;
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
  doc
    .font("Body")
    .fontSize(14)
    .fillColor("#111111")
    .text(
      `For contributing ${cert.hours} volunteering ${cert.hours === 1 ? "hour" : "hours"} to`,
      70,
      300,
      { width: W - 140, align: "center", lineBreak: false },
    );
  const eventSize = fitText(doc, cert.event.title, "BodyBold", 22, W - 145);
  doc
    .font("BodyBold")
    .fontSize(eventSize)
    .fillColor(pink)
    .text(cert.event.title, 70, 325, {
      width: W - 140,
      align: "center",
      lineBreak: false,
    });
  const eventDate = new Date(cert.event.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc
    .font("Body")
    .fontSize(11)
    .fillColor("#111111")
    .text(`Completed on ${eventDate}`, 70, 356, {
      width: W - 140,
      align: "center",
      lineBreak: false,
    });
  doc
    .fontSize(11)
    .text(
      "We appreciate your commitment and applaud your contribution to serve society.",
      65,
      376,
      { width: W - 130, align: "center", lineBreak: false },
    );
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
    .text(`Certificate ID: ${cert.certificateId}`, 29, H - 26, {
      width: H - 52,
      lineBreak: false,
    })
    .restore();
  return doc;
}
