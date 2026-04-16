import { useEffect, useRef, useState } from "react";

export interface HTMLAudioState {
  volume: number;
  playing: boolean;
}

export interface HTMLAudioProps {
  src: string;
  autoReplay?: boolean;
}

const createAudioElement = (src: string) => {
  const audio = new Audio(src);
  audio.src = src;
  return audio;
};

export function useAudio(props: HTMLAudioProps) {
  const ref = useRef<HTMLAudioElement | null>(null);

  if (!ref.current) {
    ref.current = createAudioElement(props.src);
  }

  const [state, setState] = useState<HTMLAudioState>({
    volume: 1,
    playing: false
  });

  const controls = {
    play: (): Promise<void> | void => {
      const el = ref.current;
      if (el) {
        setState((previousState) => ({
          ...previousState,
          playing: true
        }));
        return el.play();
      }
    },

    pause: (): Promise<void> | void => {
      const el = ref.current;
      if (el) {
        setState((previousState) => ({
          ...previousState,
          playing: false
        }));
        return el.pause();
      }
    },

    toggle: (): Promise<void> | void => {
      const el = ref.current;
      if (el) {
        const nextPlaying = el.paused;
        const promise = nextPlaying ? el.play() : el.pause();

        setState((previousState) => ({
          ...previousState,
          playing: nextPlaying
        }));

        return promise;
      }
    },

    volume: (value: number): void => {
      const el = ref.current;
      if (el) {
        value = Math.min(1, Math.max(0, value));
        el.volume = value;
        setState((previousState) => ({
          ...previousState,
          volume: value
        }));
      }
    }
  };

  useEffect(() => {
    const element = ref.current;

    if (!element) return undefined;

    const handler = () => {
      if (props.autoReplay) {
        void element.play();
        setState((previousState) => ({
          ...previousState,
          playing: true
        }));
        return;
      }

      setState((previousState) => ({
        ...previousState,
        playing: false
      }));
    };

    element.addEventListener("ended", handler);
    return () => {
      element.removeEventListener("ended", handler);
    };
  }, [props.autoReplay]);

  useEffect(() => {
    const el = ref.current;

    if (!el) return;

    if (el.src !== new URL(props.src, window.location.href).toString()) {
      el.src = props.src;
    }

    setState({
      volume: el.volume,
      playing: !el.paused
    });
  }, [props.src]);

  return [ref.current, state, controls, ref] as const;
}
