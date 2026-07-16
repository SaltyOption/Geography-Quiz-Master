// The "Where's Atlas?" game under ./game is vendored JavaScript (React 18-era
// JSX, no types) and is excluded from the TypeScript program in tsconfig.json.
// This ambient declaration gives the TS page wrapper a type for the game entry
// so `tsc --noEmit` resolves the import without pulling the JS into the build.
declare module "@/features/atlas/game/App" {
  import type { ComponentType } from "react";
  const App: ComponentType;
  export default App;
}
