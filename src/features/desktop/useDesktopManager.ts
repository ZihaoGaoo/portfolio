import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { apps } from "~/configs";
import type { AppsData } from "~/types";
import { animateLaunchpad, minimizeWindowToDock, restoreMinimizedWindow } from "./dom";
import type { AppVisibilityMap, DesktopState } from "./types";

const DEFAULT_WINDOW_Z_INDEX = 2;
const DEFAULT_DESKTOP_TITLE = "Finder";

const createAppStateMap = <T>(getValue: (app: AppsData) => T): Record<string, T> =>
  apps.reduce<Record<string, T>>((map, app) => {
    map[app.id] = getValue(app);
    return map;
  }, {});

const createInitialDesktopState = (): DesktopState => ({
  showApps: createAppStateMap((app) => Boolean(app.show)),
  appsZ: createAppStateMap(() => DEFAULT_WINDOW_Z_INDEX),
  maxApps: createAppStateMap(() => false),
  minApps: createAppStateMap(() => false),
  maxZ: DEFAULT_WINDOW_Z_INDEX,
  showLaunchpad: false,
  currentTitle: DEFAULT_DESKTOP_TITLE,
  hideDockAndTopbar: false,
  spotlight: false
});

const getAppById = (id: string): AppsData => {
  const currentApp = apps.find((app) => app.id === id);

  if (!currentApp) {
    throw new TypeError(`App ${id} is undefined.`);
  }

  return currentApp;
};

const toggleAppState = (
  currentMap: AppVisibilityMap,
  id: string,
  target?: boolean
): AppVisibilityMap => ({
  ...currentMap,
  [id]: target ?? !currentMap[id]
});

export function useDesktopManager() {
  const [state, setState] = useState<DesktopState>(createInitialDesktopState);
  const [spotlightBtnRef, setSpotlightBtnRef] =
    useState<RefObject<HTMLDivElement | null> | null>(null);
  const minAppsRef = useRef(state.minApps);

  useEffect(() => {
    minAppsRef.current = state.minApps;
  }, [state.minApps]);

  const toggleLaunchpad = useCallback((target: boolean): void => {
    animateLaunchpad(target);

    setState((previousState) => ({
      ...previousState,
      showLaunchpad: target
    }));
  }, []);

  const toggleSpotlight = useCallback((): void => {
    setState((previousState) => ({
      ...previousState,
      spotlight: !previousState.spotlight
    }));
  }, []);

  const setAppMax = useCallback((id: string, target?: boolean): void => {
    setState((previousState) => {
      const maxApps = toggleAppState(previousState.maxApps, id, target);

      return {
        ...previousState,
        maxApps,
        hideDockAndTopbar: maxApps[id]
      };
    });
  }, []);

  const setAppMin = useCallback((id: string, target?: boolean): void => {
    setState((previousState) => ({
      ...previousState,
      minApps: toggleAppState(previousState.minApps, id, target)
    }));
  }, []);

  const minimizeApp = useCallback(
    (id: string): void => {
      minimizeWindowToDock(id);
      setAppMin(id, true);
    },
    [setAppMin]
  );

  const closeApp = useCallback((id: string): void => {
    setState((previousState) => ({
      ...previousState,
      showApps: {
        ...previousState.showApps,
        [id]: false
      },
      maxApps: {
        ...previousState.maxApps,
        [id]: false
      },
      hideDockAndTopbar: false
    }));
  }, []);

  const openApp = useCallback((id: string): void => {
    const currentApp = getAppById(id);
    const shouldRestore = minAppsRef.current[id];

    if (shouldRestore) {
      restoreMinimizedWindow(id);
    }

    setState((previousState) => {
      const isVisible = previousState.showApps[id];
      const isFocused = previousState.appsZ[id] === previousState.maxZ;
      const shouldBringToFront = shouldRestore || !isVisible || !isFocused;
      const nextMaxZ = shouldBringToFront ? previousState.maxZ + 1 : previousState.maxZ;
      const minApps = shouldRestore
        ? {
            ...previousState.minApps,
            [id]: false
          }
        : previousState.minApps;
      const showApps = isVisible
        ? previousState.showApps
        : {
            ...previousState.showApps,
            [id]: true
          };
      const appsZ = shouldBringToFront
        ? {
            ...previousState.appsZ,
            [id]: nextMaxZ
          }
        : previousState.appsZ;

      if (
        !shouldBringToFront &&
        isVisible &&
        previousState.currentTitle === currentApp.title
      ) {
        return previousState;
      }

      return {
        ...previousState,
        showApps,
        appsZ,
        minApps,
        maxZ: nextMaxZ,
        currentTitle: currentApp.title
      };
    });
  }, []);

  const getWindowProps = useCallback(
    (app: AppsData) => ({
      id: app.id,
      title: app.title,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
      aspectRatio: app.aspectRatio,
      x: app.x,
      y: app.y,
      z: state.appsZ[app.id],
      max: state.maxApps[app.id],
      min: state.minApps[app.id],
      close: closeApp,
      setMax: setAppMax,
      setMin: minimizeApp,
      focus: openApp
    }),
    [closeApp, minimizeApp, openApp, setAppMax, state.appsZ, state.maxApps, state.minApps]
  );

  const visibleDesktopApps = useMemo(
    () => apps.filter((app) => app.desktop && state.showApps[app.id]),
    [state.showApps]
  );

  return {
    state,
    spotlightBtnRef,
    setSpotlightBtnRef,
    visibleDesktopApps,
    getWindowProps,
    toggleLaunchpad,
    toggleSpotlight,
    openApp
  };
}
