export type AppVisibilityMap = Record<string, boolean>;
export type AppZIndexMap = Record<string, number>;

export interface DesktopState {
  showApps: AppVisibilityMap;
  appsZ: AppZIndexMap;
  maxApps: AppVisibilityMap;
  minApps: AppVisibilityMap;
  maxZ: number;
  showLaunchpad: boolean;
  currentTitle: string;
  hideDockAndTopbar: boolean;
  spotlight: boolean;
}
