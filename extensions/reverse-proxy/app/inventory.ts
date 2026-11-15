import { defineInventory } from '@stackmap/extension-sdk';

import manifest from '../manifest';

import type { Component } from 'vue';

/** The reverse proxy's types in the inventory: the route's form and table columns. */
export default defineInventory<Component>(manifest, []);
