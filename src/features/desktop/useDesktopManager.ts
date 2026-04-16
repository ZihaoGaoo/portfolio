import { useState, type RefObject } from "react";
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

  const toggleLaunchpad = (target: boolean): void => {
    animateLaunchpad(target);

    setState((previousState) => ({
      ...previousState,
      showLaunchpad: target
    }));
  };

  const toggleSpotlight = (): void => {
    setState((previousState) => ({
      ...previousState,
      spotlight: !previousState.spotlight
    }));
  };

  const setAppMax = (id: string, target?: boolean): void => {
    setState((previousState) => {
      const maxApps = toggleAppState(previousState.maxApps, id, target);

      return {
        ...previousState,
        maxApps,
        hideDockAndTopbar: maxApps[id]
      };
    });
  };

  const setAppMin = (id: string, target?: boolean): void => {
    setState((previousState) => ({
      ...previousState,
      minApps: toggleAppState(previousState.minApps, id, target)
    }));
  };

  const minimizeApp = (id: string): void => {
    minimizeWindowToDock(id);
    setAppMin(id, true);
  };

  const closeApp = (id: string): void => {
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
  };

  const openApp = (id: string): void => {
    const currentApp = getAppById(id);
    const shouldRestore = state.minApps[id];

    if (shouldRestore) {
      restoreMinimizedWindow(id);
    }

    setState((previousState) => {
      const maxZ = previousState.maxZ + 1;
      const minApps = shouldRestore
        ? {
            ...previousState.minApps,
            [id]: false
          }
        : previousState.minApps;

      return {
        ...previousState,
        showApps: {
          ...previousState.showApps,
          [id]: true
        },
        appsZ: {
          ...previousState.appsZ,
          [id]: maxZ
        },
        minApps,
        maxZ,
        currentTitle: currentApp.title
      };
    });
  };

  const getWindowProps = (app: AppsData) => ({
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
  });

  const visibleDesktopApps = apps.filter((app) => app.desktop && state.showApps[app.id]);

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
