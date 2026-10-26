/** An image URL and optional rasterization metadata. SVGs use `kind: 'vector'`. */
export interface ImageAsset {
  url: string;
  width?: number;
  height?: number;
  kind?: 'raster' | 'vector';
}

/** Resolves application image identifiers. Return undefined for an unknown identifier. */
export type AssetResolver = (id: string) => ImageAsset | undefined;

/** A catalog of application-owned images. Keys are used by the Image primitive. */
export type ImageAssets = Readonly<Record<string, ImageAsset>>;

/** Builds a resolver from a catalog. Omitting the catalog treats `src` as a URL. */
export function createAssetResolver(assets?: ImageAssets | AssetResolver): AssetResolver {
  if (typeof assets === 'function') return assets;
  if (assets) return (id) => (Object.hasOwn(assets, id) ? assets[id] : undefined);
  return (url) => ({ url });
}
