import { useSnapshot } from "valtio";

import Canvas from "./canvas/index.jsx";
import Customizer from "./pages/Customizer.jsx";
import state from "./store";

function App() {
  const snap = useSnapshot(state);

  return (
    <main className="vt-app">
      <header className="vt-topbar">
        <div className="vt-brand">
          <div className="vt-logo-text">
            <span className="vt-heading-gradient">Designed</span>
            <span className="vt-heading-subtext">by Uplakshy Pathak</span>
          </div>
        </div>
      </header>

      <section className={`vt-stage-shell vt-stage-${snap.stageBackground}`}>
        <Canvas />
        <Customizer />
      </section>
    </main>
  );
}

export default App;
