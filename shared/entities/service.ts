import { unimplementedSchema } from './common';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from './common';

export interface ServiceFields extends CommonFields {
  name: string;
  /** A `service` kind of an active extension. */
  kind: string;
  /** Null for a service on no documented host, such as an external API. */
  hostId: string | null;
  image: string | null;
  containerName: string | null;
}

export type Service = EntityMeta & ServiceFields;
export type ServiceInput = CommonInput & {
  name: string;
  kind: string;
  hostId?: string | null;
  image?: string | null;
  containerName?: string | null;
};
export type ServicePatch = Partial<ServiceInput>;

export const serviceSchema: EntitySchema<ServiceFields, ServiceInput> = unimplementedSchema();
