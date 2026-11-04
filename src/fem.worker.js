import { runFem } from './fem.js';
self.onmessage = e => {
  const { spec, caseId, h, id } = e.data;
  const t0 = performance.now();
  let last = 0;
  const r = runFem(spec, caseId, h, p => { const now = performance.now(); if (now - last > 80) { last = now; self.postMessage({ id, progress: p }); } });
  r.ms = performance.now() - t0;
  self.postMessage({ id, result: r }, [r.U.buffer, r.vm.buffer]);
};
