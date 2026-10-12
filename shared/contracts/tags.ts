/** Every tag an operation may use, with what the API reference says about it. */
export interface TagDocs {
  description: string;
  externalDocs?: { description: string; url: string };
}

export const TAGS: Readonly<Record<string, TagDocs>> = {
  Extensions: {
    description: 'The installed extensions: what they add (kinds, languages), their state, and their diagnostics.',
    externalDocs: {
      description: 'Extensions in the architecture',
      url: 'https://github.com/MrStanDu33/stackmap/blob/develop/docs/ARCHITECTURE.md#extensions',
    },
  },
  System: {
    description: 'The instance itself: whether it is up, and the description of this API.',
  },
};
