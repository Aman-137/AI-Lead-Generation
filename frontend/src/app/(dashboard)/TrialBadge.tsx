"use client";

import { usePlan } from "./PlanContext";

function AnimatedCoin() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" className="inline-block -mt-1 mr-1 animate-[coinFlip_3s_ease-in-out_infinite]" style={{ transformStyle: "preserve-3d", filter: "drop-shadow(0 0 3px rgba(255,215,0,0.6))" }}>
      {/* Glow behind coin */}
      <circle cx="20" cy="20" r="16" fill="rgba(255,215,0,0.15)" className="animate-[coinGlow_2s_ease-in-out_infinite]" />
      
      {/* Shadow beneath coin */}
      <ellipse cx="20" cy="37" rx="8" ry="2" fill="rgba(0,0,0,0.15)" className="animate-[coinShadow_3s_ease-in-out_infinite]" />
      
      {/* Coin edge (3D depth) */}
      <ellipse cx="20" cy="20.8" rx="14" ry="14" fill="#996515" />
      
      {/* Coin face */}
      <circle cx="20" cy="20" r="14" fill="url(#coinFace2)" />
      
      {/* Outer rim ring - shiny */}
      <circle cx="20" cy="20" r="14" fill="none" stroke="url(#rimGrad2)" strokeWidth="2.5" />
      
      {/* Inner decorative ring */}
      <circle cx="20" cy="20" r="11" fill="none" stroke="rgba(255,248,200,0.5)" strokeWidth="0.8" strokeDasharray="2 1.5" />
      
      {/* Embossed inner circle */}
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="rgba(184,134,11,0.4)" strokeWidth="0.6" />
      
      {/* Dollar sign with deep emboss */}
      <text x="20" y="25.5" textAnchor="middle" fontSize="16" fontWeight="900" fill="rgba(100,70,0,0.25)" fontFamily="Georgia, serif">$</text>
      <text x="20" y="25" textAnchor="middle" fontSize="16" fontWeight="900" fill="url(#dollarGrad2)" fontFamily="Georgia, serif">$</text>
      
      {/* Primary shine - large sweeping glare */}
      <ellipse cx="13" cy="12" rx="5" ry="6" fill="white" opacity="0.5" transform="rotate(-40 13 12)" className="animate-[coinShine_3s_ease-in-out_infinite]" />
      
      {/* Secondary highlight */}
      <ellipse cx="25" cy="27" rx="3" ry="2" fill="white" opacity="0.2" transform="rotate(-40 25 27)" />
      
      {/* Rim highlight flare */}
      <path d="M8 14 Q6 20 8 26" fill="none" stroke="white" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" className="animate-[rimFlare_3s_ease-in-out_infinite]" />
      
      {/* Sparkle particles */}
      <circle cx="6" cy="7" r="1.5" fill="#fff8dc" className="animate-[sparkle1_2s_ease-out_infinite]" />
      <circle cx="34" cy="9" r="1.2" fill="#ffd700" className="animate-[sparkle2_2.4s_ease-out_infinite_0.5s]" />
      <circle cx="33" cy="31" r="1" fill="#fff8dc" className="animate-[sparkle3_1.8s_ease-out_infinite_1s]" />

      <defs>
        <radialGradient id="coinFace2" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fffce6" />
          <stop offset="15%" stopColor="#ffed80" />
          <stop offset="40%" stopColor="#ffd700" />
          <stop offset="70%" stopColor="#e5a800" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
        <linearGradient id="rimGrad2" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fffce6" />
          <stop offset="20%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#e5a800" />
          <stop offset="80%" stopColor="#b8860b" />
          <stop offset="100%" stopColor="#fffce6" />
        </linearGradient>
        <linearGradient id="dollarGrad2" x1="16" y1="12" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#996515" />
          <stop offset="40%" stopColor="#6b4510" />
          <stop offset="100%" stopColor="#3d2e08" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function TrialBadge() {
  const { isOnTrial, trialDaysLeft, loaded } = usePlan();

  if (!loaded || !isOnTrial || trialDaysLeft === null) return null;

  return (
    <p className="text-xs font-semibold tracking-wide animate-[slideIn_0.6s_ease-out_forwards]" style={{ color: "#3d3580" }}>
      {trialDaysLeft > 0 ? (
        <>
          <AnimatedCoin /> <span className="font-extrabold">{trialDaysLeft}</span> day{trialDaysLeft !== 1 ? "s" : ""} left on your free trial
        </>
      ) : (
        <span style={{ color: "#dc2626" }}>⚠️ Your trial has expired</span>
      )}
    </p>
  );
}
