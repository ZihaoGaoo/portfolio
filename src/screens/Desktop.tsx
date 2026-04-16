import { wallpapers } from "~/configs";
import AppWindow from "~/components/AppWindow";
import Launchpad from "~/components/Launchpad";
import Spotlight from "~/components/Spotlight";
import Dock from "~/components/dock/Dock";
import TopBar from "~/components/menus/TopBar";
import { useDesktopManager } from "~/features";
import { useStore } from "~/stores";
import { minMarginY } from "~/utils";
import type { MacActions } from "~/types";

export default function Desktop(props: MacActions) {
  const { dark, brightness } = useStore((state) => ({
    dark: state.dark,
    brightness: state.brightness
  }));
  const {
    state,
    spotlightBtnRef,
    setSpotlightBtnRef,
    visibleDesktopApps,
    getWindowProps,
    toggleLaunchpad,
    toggleSpotlight,
    openApp
  } = useDesktopManager();

  return (
    <div
      className="size-full overflow-hidden bg-center bg-cover"
      style={{
        backgroundImage: `url(${dark ? wallpapers.night : wallpapers.day})`,
        filter: `brightness( ${(brightness as number) * 0.7 + 50}% )`
      }}
    >
      {/* Top Menu Bar */}
      <TopBar
        title={state.currentTitle}
        setLogin={props.setLogin}
        shutMac={props.shutMac}
        sleepMac={props.sleepMac}
        restartMac={props.restartMac}
        toggleSpotlight={toggleSpotlight}
        hide={state.hideDockAndTopbar}
        setSpotlightBtnRef={setSpotlightBtnRef}
      />

      {/* Desktop Apps */}
      <div className="window-bound z-10 absolute" style={{ top: minMarginY }}>
        {visibleDesktopApps.map((app) => (
          <AppWindow key={`desktop-app-${app.id}`} {...getWindowProps(app)}>
            {app.content}
          </AppWindow>
        ))}
      </div>

      {/* Spotlight */}
      {state.spotlight && (
        <Spotlight
          openApp={openApp}
          toggleLaunchpad={toggleLaunchpad}
          toggleSpotlight={toggleSpotlight}
          btnRef={spotlightBtnRef}
        />
      )}

      {/* Launchpad */}
      <Launchpad show={state.showLaunchpad} toggleLaunchpad={toggleLaunchpad} />

      {/* Dock */}
      <Dock
        open={openApp}
        showApps={state.showApps}
        showLaunchpad={state.showLaunchpad}
        toggleLaunchpad={toggleLaunchpad}
        hide={state.hideDockAndTopbar}
      />
    </div>
  );
}
