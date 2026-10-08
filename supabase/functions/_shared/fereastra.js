// grades.js și kinds.js sunt scrise pentru pagină (window.Grades, window.Shared.fmt).
// Pe server le dăm o „fereastră" și un fmt simplu; se importă înaintea lor.
globalThis.window = globalThis;
globalThis.Shared = globalThis.Shared || { fmt: (v, d = 0) => Number(v).toFixed(d) };
