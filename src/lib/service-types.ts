export type ServiceMediaType = "NONE" | "IMAGE" | "VIDEO";

export type ServiceDto = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  icon: string;
  mediaType: ServiceMediaType;
  mediaUrl: string | null;
  posterUrl: string | null;
  active: boolean;
  sortOrder: number;
  /// Lowest tier allowed to apply; null means every member.
  minTierId: string | null;
  updatedAt: string;
};
