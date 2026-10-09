// Lets the server import the app's own TypeScript (src/services, src/utils, src/models). Loaded with
// --import. Two things differ from what Node does on its own:
//  - the app's relative imports leave out the `.ts` extension, as bundlers allow;
//  - `import { RRule } from 'rrule'` needs named exports, which rrule's CommonJS build doesn't
//    declare in a way Node can see, so it goes through rrule-shim.js.
import { registerHooks } from 'node:module';

const SHIM = new URL('./rrule-shim.js', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'rrule' && context.parentURL !== SHIM) return { url: SHIM, shortCircuit: true };
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!/^\.{1,2}\//.test(specifier) || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
