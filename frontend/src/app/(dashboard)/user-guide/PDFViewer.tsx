"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PDFViewer() {
  const [numPages, setNumPages] = useState<number>(0);

  return (
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
            />
          </div>
        </div>
      ))}
    </Document>
  );
}
