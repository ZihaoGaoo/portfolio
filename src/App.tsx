import Desktop from "~/screens/Desktop";
import Login from "~/screens/Login";
import Boot from "~/screens/Boot";
import { useMacSession } from "~/features";

export default function App() {
  const { session, actions, finishBooting } = useMacSession();

  if (session.booting) {
    return (
      <Boot
        restart={session.restart}
        sleep={session.sleep}
        finishBooting={finishBooting}
      />
    );
  }

  if (session.login) {
    return (
      <Desktop
        setLogin={actions.setLogin}
        shutMac={actions.shutMac}
        sleepMac={actions.sleepMac}
        restartMac={actions.restartMac}
      />
    );
  }

  return (
    <Login
      setLogin={actions.setLogin}
      shutMac={actions.shutMac}
      sleepMac={actions.sleepMac}
      restartMac={actions.restartMac}
    />
  );
}
