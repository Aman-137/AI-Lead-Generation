"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PDFViewer() {
  const [numPages, setNumPages] = useState<number>(0);

  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Disable keyboard shortcuts for copy/select/print/save
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "C" || e.key === "a" || e.key === "A" || e.key === "p" || e.key === "P" || e.key === "s" || e.key === "S")
      ) {
        e.preventDefault();
      }
      if (e.key === "PrintScreen") {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      className="select-none"
      style={{ WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none", userSelect: "none" }}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <Document
        file="/docs/inertia_leads_help_guide.pdf"
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i + 1} className="relative">
            {/* Smoke glow behind each page */}
            <div
              className="absolute -inset-6 rounded-3xl"
              style={{ background: "radial-gradient(ellipse at center, rgba(105,98,196,0.35) 0%, rgba(61,53,128,0.2) 40%, transparent 70%)", filter: "blur(25px)", animation: `smoke${(i % 3) + 1} ${8 + (i % 3) * 2}s ease-in-out infinite` }}
            />
            <div
              className="relative rounded-xl overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(105,98,196,0.2), 0 0 0 1px rgba(105,98,196,0.1)" }}
            >
              <Page
                pageNumber={i + 1}
                width={Math.min(850, window.innerWidth - 380)}
                renderTextLayer={false}
              />
            </div>
          </div>
        ))}
      </Document>
    </div>
  );
}
