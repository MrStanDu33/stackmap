// Lets plain TypeScript tools (typescript-eslint) type `.vue` imports; vue-tsc resolves the real component types.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}
