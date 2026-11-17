/** An item the palette can list: a page, a workspace, an action or an entity. */
export interface PaletteItem {
  id: string;
  label: string;
  /** A second line, such as an entity's type. */
  description?: string;
  icon?: string;
}

/** Items under a named heading. */
export interface PaletteGroup {
  id: string;
  label: string;
  items: PaletteItem[];
}
