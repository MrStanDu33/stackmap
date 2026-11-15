import { defineInventory } from '@stackmap/extension-sdk';

import manifest from '../manifest';

import type { Component } from 'vue';

/** The NAT extension's types in the inventory: the port forward's form and table columns. */
export default defineInventory<Component>(manifest, []);
