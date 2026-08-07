type SocialMetaInput = {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: "website" | "article" | "profile";
};

export function absoluteUrl(siteUrl: string, path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}

export function socialMeta({ title, description, url, image, type = "website" }: SocialMetaInput) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: "Phantom Freedom" },
    { property: "og:type", content: type },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(url ? [{ property: "og:url", content: url }] : []),
    ...(image ? [{ property: "og:image", content: image }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
}
