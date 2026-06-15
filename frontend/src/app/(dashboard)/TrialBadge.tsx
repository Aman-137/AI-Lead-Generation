"use client";

import { usePlan } from "./PlanContext";

function AnimatedTrialIcon() {
  return (
    <span className="relative inline-flex items-center justify-center w-8 h-8 mr-1">
      <svg width="25" height="25" viewBox="0 0 28 28" fill="none" className="relative z-10 animate-[coinSpin_3s_ease-in-out_infinite]" style={{ shapeRendering: "geometricPrecision", transformStyle: "preserve-3d" }}>
        {/* Coin edge */}
        <circle cx="14" cy="14.6" r="11" fill="#a67c00" />
        
        {/* Coin face */}
        <circle cx="14" cy="14" r="11" fill="url(#gf)" />
        
        {/* Rim */}
        <circle cx="14" cy="14" r="11" fill="none" stroke="#c59b1d" strokeWidth="1.2" />
        <circle cx="14" cy="14" r="9" fill="none" stroke="rgba(255,230,100,0.4)" strokeWidth="0.7" />
        
        {/* Dollar sign */}
        <text x="14" y="18.5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#6b4e00" fontFamily="Arial, sans-serif">$</text>
        
        {/* Shine */}
        {/* <ellipse cx="10" cy="10" rx="3.5" ry="4" fill="white" opacity="0.45" transform="rotate(-40 10 10)" className="animate-[goldShine_2.5s_ease-in-out_infinite]" /> */}
        
        {/* Star sparkles */}
        <polygon points="3,3 3.5,4.5 5,4.5 4,5.5 4.3,7 3,6 1.7,7 2,5.5 1,4.5 2.5,4.5" fill="#ffe066" className="animate-[starPop_1.5s_ease-out_infinite]" />
        <polygon points="25,2 25.4,3.2 26.6,3.2 25.6,4 25.9,5.2 25,4.4 24.1,5.2 24.4,4 23.4,3.2 24.6,3.2" fill="#ffd700" className="animate-[starPop_1.8s_ease-out_infinite_0.5s]" />
        <polygon points="25,23 25.4,24 26.4,24 25.5,24.7 25.8,25.7 25,25 24.2,25.7 24.5,24.7 23.6,24 24.6,24" fill="#ffe066" className="animate-[starPop_2s_ease-out_infinite_1s]" />
        
        <defs>
          <radialGradient id="gf" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#fff2a8" />
            <stop offset="40%" stopColor="#ffd000" />
            <stop offset="80%" stopColor="#c59b1d" />
            <stop offset="100%" stopColor="#a67c00" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}

export default function TrialBadge() {
  const { isOnTrial, trialDaysLeft, loaded } = usePlan();

  if (!loaded || !isOnTrial || trialDaysLeft === null) return null;

  return (
    <div className="flex items-center gap-0 animate-[slideIn_0.6s_ease-out_forwards]">
      <AnimatedTrialIcon />
      <p className="text-xs font-semibold tracking-wide" style={{ color: "#3d3580" }}>
        {trialDaysLeft > 0 ? (
          <>
            <span className="font-extrabold">{trialDaysLeft}</span> day{trialDaysLeft !== 1 ? "s" : ""} left on your free trial
          </>
        ) : (
          <span style={{ color: "#dc2626" }}>Your trial has expired</span>
        )}
      </p>
    </div>
  );
}
