"use client";

interface LoaderProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
}

export default function Loader({ text, size = "md", fullPage = false }: LoaderProps) {
  const sizes = {
    sm: { outer: "w-8 h-8", inner: "w-5 h-5", dot: "w-1.5 h-1.5", text: "text-xs" },
    md: { outer: "w-14 h-14", inner: "w-9 h-9", dot: "w-2 h-2", text: "text-sm" },
    lg: { outer: "w-20 h-20", inner: "w-13 h-13", dot: "w-2.5 h-2.5", text: "text-base" },
  };

  const s = sizes[size];

  const content = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Outer ring — slow spin */}
        <div className={`${s.outer} rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin`}
          style={{ animationDuration: "1.2s" }}
        />
        {/* Inner ring — reverse spin */}
        <div className={`absolute inset-0 m-auto ${s.inner} rounded-full border-2 border-amber-400/20 border-b-amber-400 animate-spin`}
          style={{ animationDuration: "0.9s", animationDirection: "reverse" }}
        />
        {/* Center dot — pulse */}
        <div className={`absolute inset-0 m-auto ${s.dot} rounded-full bg-gradient-to-br from-violet-500 to-amber-400 animate-pulse`} />
      </div>
      {text && (
        <p className={`${s.text} font-medium text-gray-500 animate-pulse`}>{text}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
