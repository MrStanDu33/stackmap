/** Component files of the app and of built-in extensions (pages, layouts and app.vue are not components). */
const COMPONENT = /^(?:extensions\/[^/]+\/)?app\/components\/.+\.vue$/;

/**
 * @param {string[]} files Repository-relative paths.
 * @returns {string[]} Components that have no `<Name>.stories.ts` next to them.
 */
export const findComponentsWithoutStories = (files) => {
  const all = new Set(files);
  return files
    .filter((file) => COMPONENT.test(file))
    .filter((file) => !all.has(file.replace(/\.vue$/, '.stories.ts')));
};
