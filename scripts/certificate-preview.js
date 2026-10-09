import { createWriteStream } from "node:fs";
import { createCertificateDocument } from "../server/utils/renderCertificate.js";
const cert = {
  volunteer: { name: process.argv[2] || "Maya Patel" },
  event: {
    title: process.argv[3] || "Tree Plantation Drive",
    date: "2026-10-09T09:00:00+05:30",
  },
  hours: 4,
  certificateId: "WWC-PREVIEW-2026-001",
};
const stream = createWriteStream("output/pdf/certificate-preview.pdf");
const doc = createCertificateDocument(cert);
doc.pipe(stream);
doc.end();
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log("Certificate preview written.");
