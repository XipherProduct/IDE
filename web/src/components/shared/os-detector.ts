"use client";

import { useEffect, useState } from "react";

export type DetectedOS = "macos" | "linux" | "windows";

export function useDetectedOS(): DetectedOS {
  const [os, setOs] = useState<DetectedOS>("macos");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) {
      setOs("windows");
    } else if (ua.includes("linux")) {
      setOs("linux");
    } else {
      setOs("macos");
    }
  }, []);

  return os;
}

export function getOSLabel(os: DetectedOS): string {
  switch (os) {
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "windows":
      return "Windows";
  }
}
