import { useEffect, useState } from "react";

interface WindowSizeState {
  winWidth: number;
  winHeight: number;
}

const getWindowSize = (): WindowSizeState => {
  if (typeof window === "undefined") {
    return {
      winWidth: 0,
      winHeight: 0
    };
  }

  return {
    winWidth: window.innerWidth,
    winHeight: window.innerHeight
  };
};

export function useWindowSize() {
  const [state, setState] = useState<WindowSizeState>(getWindowSize);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = () => {
      setState(getWindowSize());
    };

    handler();
    window.addEventListener("resize", handler);

    return () => {
      window.removeEventListener("resize", handler);
    };
  }, []);

  return state;
}
