export interface ReleaseAssetNames {
  readonly packageName: string;
  readonly archiveFileName: string;
  readonly metadataFileName: string;
}

/** Names every release asset from the package version and its target platform. */
export function releaseAssetNames(
  version: string,
  target: string,
  windows: boolean,
): ReleaseAssetNames {
  const packageName = `lore-${version}-${target}`;
  const archiveExtension = windows ? "zip" : "tar.gz";
  return Object.freeze({
    packageName,
    archiveFileName: `${packageName}.${archiveExtension}`,
    metadataFileName: `${packageName}.metadata.json`,
  });
}
