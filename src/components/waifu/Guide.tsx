// In-panel guide for making Albedo in VRoid Studio and loading the .vrm here.
export default function Guide() {
  return (
    <div className="vrm-guide">
      <h3>Make Albedo in VRoid Studio (free)</h3>
      <ol>
        <li>
          Download <strong>VRoid Studio</strong> from{" "}
          <a href="https://vroid.com/en/studio" target="_blank" rel="noopener noreferrer">
            vroid.com/studio
          </a>{" "}
          (Windows/macOS, no account needed) and create a new model.
        </li>
        <li>
          <strong>Face</strong>: set the gaze to sharp, brows lowered. <strong>Hair</strong>: long white/silver hair with a
          single thick braid down the back — the preset "Braid" base works; recolor to <em>near-white</em> (#F5F5F5) with
          black tips.
        </li>
        <li>
          <strong>Face texture</strong>: keep skin pale (#F3E9E4). <strong>Eyes</strong>: vertical-slit pupils, red/crimson
          iris — VRoid lets you paint the iris texture; or pick the "slit" pupil preset and recolor.
        </li>
        <li>
          <strong>Outfit</strong>: the default "Dress" category closest to Albedo's white suit-dress: white base with black
          trim, long sleeves, high collar. Recolor the default school-uniform pieces white/black in the outfit tab.
        </li>
        <li>
          <strong>Horns</strong>: VRoid has no horn bones — attach small cone shapes as hair accessories ("Add texture" →
          import a small PNG of a horn, place on temples) or skip them.
        </li>
        <li>
          <strong>Export</strong>: top-right menu → <em>Export as VRM</em> → reduce textures if the file is &gt;50 MB →
          save as <code>albedo.vrm</code>.
        </li>
        <li>
          Back here: press <strong>Load VRM</strong> above and pick the file. It is saved in your browser (IndexedDB) and
          survives reloads. Press <strong>Reset</strong> to go back to the tinted sample model.
        </li>
      </ol>
      <p className="hint">
        VRM 0.x and 1.0 both work. If the model spawns lying down, that is a VRM1 convention — this app already handles
        it. Free ready-made VRM samples: <a href="https://vroid.com/en/quests" target="_blank" rel="noopener noreferrer">VRoid Hub quests</a>,{" "}
        <a href="https://booth.pm" target="_blank" rel="noopener noreferrer">BOOTH</a> (search "Albedo VRM").
      </p>
    </div>
  );
}
