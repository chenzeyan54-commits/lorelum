import type { PackSnapshot } from "./types";

/** The Pack metadata exposed by the rich installed-Pack catalog. */
export type InstalledPackDetails = Readonly<
  Pick<PackSnapshot, "name" | "version" | "description" | "applies_to"> & {
    packRoot: string;
  }
>;

/** Copy only the public Pack metadata fields across the LocalStore boundary. */
export function toInstalledPackDetails(pack: InstalledPackDetails): InstalledPackDetails {
  return Object.freeze({
    name: pack.name,
    version: pack.version,
    packRoot: pack.packRoot,
    ...(pack.description === undefined ? {} : { description: pack.description }),
    ...(pack.applies_to === undefined ? {} : { applies_to: Object.freeze([...pack.applies_to]) }),
  });
}
