import { minMarginY } from "~/utils";

const getRequiredElement = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);

  if (!element) {
    throw new TypeError(`Element ${selector} is undefined.`);
  }

  return element;
};

export const animateLaunchpad = (target: boolean): void => {
  const launchpad = getRequiredElement("#launchpad");

  launchpad.style.transform = target ? "scale(1)" : "scale(1.1)";
  launchpad.style.transition = target ? "ease-in 0.2s" : "ease-out 0.2s";
};

export const cacheWindowPosition = (id: string): void => {
  const windowElement = getRequiredElement(`#window-${id}`);
  const rect = windowElement.getBoundingClientRect();

  windowElement.style.setProperty(
    "--window-transform-x",
    `${(window.innerWidth + rect.x).toFixed(1)}px`
  );
  windowElement.style.setProperty(
    "--window-transform-y",
    `${(rect.y - minMarginY).toFixed(1)}px`
  );
};

export const minimizeWindowToDock = (id: string): void => {
  cacheWindowPosition(id);

  const dockElement = getRequiredElement(`#dock-${id}`);
  const dockRect = dockElement.getBoundingClientRect();
  const windowElement = getRequiredElement(`#window-${id}`);

  const posY = window.innerHeight - windowElement.offsetHeight / 2 - minMarginY;
  const posX = window.innerWidth + dockRect.x - windowElement.offsetWidth / 2 + 25;

  windowElement.style.transform = `translate(${posX}px, ${posY}px) scale(0.2)`;
  windowElement.style.transition = "ease-out 0.3s";
};

export const restoreMinimizedWindow = (id: string): void => {
  const windowElement = getRequiredElement(`#window-${id}`);

  windowElement.style.transform = `translate(${windowElement.style.getPropertyValue(
    "--window-transform-x"
  )}, ${windowElement.style.getPropertyValue("--window-transform-y")}) scale(1)`;
  windowElement.style.transition = "ease-in 0.3s";
};
