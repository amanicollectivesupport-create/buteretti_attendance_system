import React from 'react';

interface ButereLogoProps {
  className?: string;
  size?: number;
  gearColor?: string;
  ribbonColor?: string;
  padlockColor?: string;
  textColor?: string;
}

export default function ButereLogo({
  className = '',
  size = 120,
  gearColor = '#ff3b30', // Vibrant Red
  ribbonColor = '#007aff', // Bright Royal Blue
  padlockColor = '#00a2ff', // Sky Blue
  textColor = '#ffffff'
}: ButereLogoProps) {
  return (
    <svg
      id="butere-institute-logo"
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={`select-none shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Curved Paths for Text Alignment */}
        <path
          id="curve-top"
          d="M 60,200 A 140,140 0 0,1 340,200"
          fill="none"
        />
        <path
          id="curve-bottom"
          d="M 340,200 A 140,140 0 0,1 60,200"
          fill="none"
        />
        {/* Drop shadow for ribbon and depth */}
        <filter id="logo-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* 1. Red Outer Gear (Cogwheel) */}
      <g id="gear-wheels" fill={gearColor}>
        {/* Main outer ring */}
        <circle cx="200" cy="200" r="150" />
        
        {/* 8 Gear teeth (Rectangles rotated around center) */}
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(0 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(45 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(90 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(135 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(180 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(225 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(270 200 200)" />
        <rect x="175" y="30" width="50" height="40" rx="8" transform="rotate(315 200 200)" />
      </g>

      {/* Inner White Circle (The Crest Canvas) */}
      <circle cx="200" cy="200" r="118" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx="200" cy="200" r="126" fill="none" stroke={gearColor} strokeWidth="5" />

      {/* 2. Text Around the Crest ("BUTERE TECHNICAL" & "TRAINING INSTITUTE") */}
      <text fontStyle="normal" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" fontSize="23" fill={textColor} letterSpacing="3">
        <textPath href="#curve-top" startOffset="50%" textAnchor="middle">
          BUTERE TECHNICAL
        </textPath>
      </text>
      
      <text fontStyle="normal" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fill={textColor} letterSpacing="3">
        <textPath href="#curve-bottom" startOffset="50%" textAnchor="middle">
          TRAINING INSTITUTE
        </textPath>
      </text>

      {/* 3. Central Elements Group */}
      <g id="central-crest-elements">
        {/* A. Graduation Cap (Top Center) */}
        <g id="graduation-cap" transform="translate(145, 102) scale(1.1)">
          {/* Cap diamond */}
          <polygon points="50,10 95,28 50,46 5,28" fill="#1e293b" stroke="#000000" strokeWidth="1" />
          {/* Cap base/skull */}
          <path d="M 23,34 L 23,45 C 23,53 77,53 77,45 L 77,34" fill="#1e293b" stroke="#000000" strokeWidth="1" />
          {/* Tassel */}
          <path d="M 50,28 L 82,34 L 82,48" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
          <circle cx="82" cy="49" r="2.5" fill="#eab308" />
        </g>

        {/* B. Padlock & Key (Center) */}
        <g id="security-padlock" transform="translate(162, 162)">
          {/* Padlock Shackle */}
          <path d="M 25,25 A 18,18 0 0,1 51,25" fill="none" stroke={padlockColor} strokeWidth="7" strokeLinecap="round" />
          {/* Padlock Body */}
          <rect x="13" y="24" width="50" height="38" rx="8" fill={padlockColor} stroke="#0284c7" strokeWidth="1" />
          {/* Keyhole (white circle + small slit) */}
          <circle cx="38" cy="40" r="4.5" fill="#ffffff" />
          <polygon points="36,40 40,40 41,49 35,49" fill="#ffffff" />
          
          {/* Key (Red inserted on the right) */}
          <g id="inserted-key" transform="translate(48, 36) scale(0.95)">
            {/* Key shaft */}
            <rect x="10" y="3" width="22" height="4" fill="#ef4444" rx="1" />
            {/* Key head (circular) */}
            <circle cx="6" cy="5" r="5" fill="#ef4444" />
            <circle cx="6" cy="5" r="2" fill="#ffffff" />
            {/* Key teeth */}
            <rect x="22" y="7" width="3" height="4" fill="#ef4444" rx="0.5" />
            <rect x="27" y="7" width="3" height="4" fill="#ef4444" rx="0.5" />
          </g>
        </g>

        {/* C. Open Book and Hands with Tools (Bottom Center) */}
        <g id="open-book-and-tools" transform="translate(133, 222)">
          {/* Open Book Pages */}
          {/* Left page */}
          <path d="M 67,40 C 47,24 23,24 3,32 L 3,55 C 23,47 47,47 67,63 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />
          {/* Right page */}
          <path d="M 67,40 C 87,24 111,24 131,32 L 131,55 C 111,47 87,47 67,63 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />
          
          {/* Hammer on left page */}
          <g id="hammer-icon" transform="translate(20, 36) scale(0.45)">
            {/* Handle */}
            <line x1="20" y1="50" x2="50" y2="20" stroke="#000000" strokeWidth="6" strokeLinecap="round" />
            {/* Hammer head */}
            <path d="M 38,12 L 56,30 L 50,36 L 44,30 L 32,42 L 26,36 Z" fill="#475569" stroke="#000000" strokeWidth="2" />
            {/* Claw */}
            <path d="M 44,30 C 48,24 55,20 62,21 L 56,30 Z" fill="#475569" stroke="#000000" strokeWidth="2" />
          </g>

          {/* Wrench on right page */}
          <g id="wrench-icon" transform="translate(85, 34) scale(0.45)">
            {/* Handle */}
            <line x1="15" y1="15" x2="55" y2="55" stroke="#000000" strokeWidth="8" strokeLinecap="round" />
            {/* Wrench jaw left */}
            <path d="M 42,42 C 48,34 60,34 66,42 C 70,46 72,54 68,60 L 54,46 L 46,54 L 60,68 C 54,72 46,70 42,66 C 34,60 34,48 42,42 Z" fill="#475569" stroke="#000000" strokeWidth="2" />
            {/* Wrench jaw right */}
            <path d="M 12,12 C 18,4 30,4 36,12 C 40,16 42,24 38,30 L 24,16 L 16,24 L 30,38 C 24,42 16,40 12,36 C 4,30 4,18 12,12 Z" fill="#475569" stroke="#000000" strokeWidth="2" />
          </g>
        </g>
      </g>

      {/* 4. Bottom Ribbon Banner ("OPENING DOORS TO GREAT CAREERS") */}
      <g id="motto-ribbon" filter="url(#logo-shadow)" transform="translate(0, 10)">
        {/* Left folded ribbon end */}
        <polygon points="40,310 20,325 40,340 55,325" fill="#005ecb" />
        <polygon points="55,325 40,340 70,340" fill="#004393" />
        
        {/* Right folded ribbon end */}
        <polygon points="360,310 380,325 360,340 345,325" fill="#005ecb" />
        <polygon points="345,325 360,340 330,340" fill="#004393" />

        {/* Main Ribbon Body */}
        <rect x="60" y="315" width="280" height="28" fill={ribbonColor} rx="3" stroke="#005ecb" strokeWidth="1" />
        
        {/* Ribbon Motto Text */}
        <text
          x="200"
          y="333"
          fill="#ffffff"
          fontSize="11.5"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
          textAnchor="middle"
          letterSpacing="0.6"
        >
          OPENING DOORS TO GREAT CAREERS
        </text>
      </g>
    </svg>
  );
}
