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
  Traces: {
    description: 'The path of a request to a hostname, hop by hop, computed from the workspace\'s flows.',
  },
  Traffic: {
    description: 'The flows between a workspace\'s clients, services and listeners, for the traffic graph.',
  },
  Workspaces: {
    description: 'Isolated sets of infrastructure data. Setup can add a `demo` workspace with a fictional home lab.',
  },
  Accounts: {
    description: 'Setting up the first administrator, and signing in and out. The session is a cookie.',
  },
  System: {
    description: 'The instance itself: whether it is up, and the description of this API.',
  },
};
