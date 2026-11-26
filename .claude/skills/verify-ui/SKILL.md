---
name: verify-ui
description: Check a page or layout change in a real browser (keyboard, both themes, strict contrast, French, zoom) and report what was seen. Use before a UI task counts as done; stories and e2e tests prove behavior, this catches what passes but looks wrong.
argument-hint: <page path, e.g. /w/demo/graph>
---

# Verify a UI change in the browser

1. **Start a throwaway instance**, never the user's own data or account. The user's `.env` may set `DATABASE_URL`,
   which wins over `DATA_DIR`, so load an env file of your own instead and set the database explicitly. Write
   `.ai/verify-ui.env` (gitignored) with:

   ```sh
   DATA_DIR=<scratchpad>/verify-ui
   DATABASE_URL=file:<scratchpad>/verify-ui/stackmap.sqlite
   STACKMAP_DEMO=true
   BETTER_AUTH_URL=http://localhost:3100
   ```

   then start it in the background (`corepack pnpm` if the global pnpm cannot switch versions):

   ```sh
   pnpm exec nuxt dev --port 3100 --dotenv .ai/verify-ui.env
   ```

   **Before anything else**, check that the log says it applied the migrations and seeded the demo workspace, and
   that `<scratchpad>/verify-ui/stackmap.sqlite` exists. If not, stop the server at once and tell the user: it may be
   pointing at their database.
2. Open `http://localhost:3100/setup` and create the first administrator with test credentials you generate
   (fictional `.example` email), kept in a file in the scratchpad; do not repeat them in chat.
3. **Open the page** with the Playwright MCP (`browser_navigate`, then `browser_snapshot`; the desktop app's built-in
   browser works too). For a component in isolation, `pnpm storybook` and its MCP list the stories.
4. **Check, and note what you saw** for each:
   - the change itself does what the spec says, in every state you can reach (empty, error, each role you can sign in
     as);
   - keyboard only: Tab order, visible focus never hidden behind the sidebar or a panel, Escape closes and returns
     focus, every action reachable without a pointer, no drag without a single-pointer alternative;
   - both themes (`midnight`, `light`) and strict contrast, switched from the display preferences in the sidebar;
   - French, from the same preferences: no English left, no clipped or overflowing text;
   - 200% zoom (`browser_resize` to half the width) and a narrow screen (the sidebar becomes a drawer);
   - targets at least 24 px; no information by color alone;
   - `browser_console_messages`: no errors or warnings caused by the change.
5. **Report** a short table: check, result (ok / issue), and for each issue the page, the steps, and a screenshot
   (`browser_take_screenshot`) if it helps. Do not fix anything in this skill; propose fixes, test-first.
6. Stop the dev server, close the browser, and delete `<scratchpad>/verify-ui` and `.ai/verify-ui.env`.
