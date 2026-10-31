/**
 * Rendered pages hold the signed-in user's data: never stored, by the browser or a proxy. `no-store` also keeps them
 * out of the back-forward cache, so Back after signing out asks the server again rather than showing the old page.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response) => {
    response.headers = { ...response.headers, 'cache-control': 'no-store' };
  });
});
