"use client";

import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("./PDFViewer"), { ssr: false });

export default function UserGuidePage() {
  return (
    <div className="-m-8 -mt-[88px] ml-0 pt-16 h-screen overflow-hidden relative">
      <div className="relative h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex flex-col items-center gap-8 px-6 py-6">
          <PDFViewer />
        </div>
      </div>
    </div>
  );
}
