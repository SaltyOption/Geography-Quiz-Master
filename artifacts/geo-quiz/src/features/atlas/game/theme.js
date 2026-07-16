// Design tokens (nautical chart palette) — see SPEC.md "Tech stack".
export const C = {
  ocean: "#0B2233",
  panel: "#12314A",
  panelLite: "#1A3F5C",
  ink: "#E8F1F4",
  faded: "#8FB0BF",
  coral: "#FF7A5C",
  teal: "#3FC9A5",
  sand: "#E4C580",
  line: "#25506F",
};

export const FONT = {
  ui: "'Space Grotesk', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

// Proximity → colour (green when hot, sand when warm, coral when cold).
export const proxColor = (p) => (p >= 90 ? C.teal : p >= 60 ? C.sand : C.coral);
