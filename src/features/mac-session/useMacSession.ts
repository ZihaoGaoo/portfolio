import { useState, type MouseEvent } from "react";
import type { MacActions } from "~/types";

interface MacSessionState {
  login: boolean;
  booting: boolean;
  restart: boolean;
  sleep: boolean;
}

const initialMacSessionState: MacSessionState = {
  login: false,
  booting: true,
  restart: true,
  sleep: false
};

const resolveStateUpdate = (
  value: boolean | ((prevVar: boolean) => boolean),
  previousValue: boolean
) => (typeof value === "function" ? value(previousValue) : value);

export function useMacSession() {
  const [session, setSession] = useState<MacSessionState>(initialMacSessionState);

  const setLogin: MacActions["setLogin"] = (value) => {
    setSession((previousState) => ({
      ...previousState,
      login: resolveStateUpdate(value, previousState.login)
    }));
  };

  const finishBooting = () => {
    setSession((previousState) => ({
      ...previousState,
      login: true,
      booting: false,
      restart: false,
      sleep: false
    }));
  };

  const startBootSequence =
    (nextPowerState: Pick<MacSessionState, "restart" | "sleep">) =>
    (event: MouseEvent): void => {
      event.stopPropagation();

      setSession((previousState) => ({
        ...previousState,
        ...nextPowerState,
        login: false,
        booting: true
      }));
    };

  const actions: MacActions = {
    setLogin,
    shutMac: startBootSequence({ restart: false, sleep: false }),
    restartMac: startBootSequence({ restart: true, sleep: false }),
    sleepMac: startBootSequence({ restart: false, sleep: true })
  };

  return {
    session,
    actions,
    finishBooting
  };
}
