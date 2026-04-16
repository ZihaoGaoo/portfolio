"use client";

import dynamic from "next/dynamic";

const MacApp = dynamic(() => import("~/App"), { ssr: false });

export default function Page() {
  return <MacApp />;
}
