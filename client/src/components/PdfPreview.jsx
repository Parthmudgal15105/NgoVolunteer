import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;
export default function PdfPreview({ url }) {
  const canvas = useRef(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      task;
    setLoading(true);
    setError("");
    const documentTask = getDocument({ url });
    documentTask.promise
      .then(async (pdf) => {
        const page = await pdf.getPage(1);
        if (!active) return;
        const viewport = page.getViewport({ scale: 2 });
        const target = canvas.current;
        target.width = viewport.width;
        target.height = viewport.height;
        task = page.render({
          canvasContext: target.getContext("2d"),
          viewport,
        });
        await task.promise;
        if (active) setLoading(false);
      })
      .catch((e) => {
        if (active) {
          console.error("Certificate preview could not render:", e);
          setError(
            "Unable to display the certificate. You can still download the PDF.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      task?.cancel();
      documentTask.destroy();
    };
  }, [url]);
  return (
    <div className="pdf-preview">
      {loading && (
        <div className="pdf-loading" role="status">
          Preparing your certificate…
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <canvas
        ref={canvas}
        aria-label="Certificate of Appreciation preview"
        role="img"
        style={{ display: loading || error ? "none" : "block" }}
      />
    </div>
  );
}
