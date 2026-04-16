export interface AvatarStyle {
  label: string;
  prompt: string;
}

export const AVATAR_STYLES: AvatarStyle[] = [
  { label: "Pixel Hero", prompt: "pixel art hero character, 8-bit style, colorful" },
  { label: "Anime", prompt: "anime character, vibrant colors, expressive eyes, manga style" },
  { label: "Superhero", prompt: "superhero character, cape, bold colors, comic book style" },
  { label: "Robot", prompt: "friendly robot character, metallic, glowing eyes, futuristic" },
  { label: "Fantasy", prompt: "fantasy character, wizard or warrior, magical, epic" },
  { label: "Animal", prompt: "anthropomorphic animal character, cute, expressive" },
  { label: "Cartoon", prompt: "cartoon character, bold outlines, exaggerated features, fun" },
  { label: "Alien", prompt: "alien creature character, otherworldly, colorful, unique" },
];

export const AVATAR_PROMPT_PREFIX =
  "Portrait avatar character, centered, colorful, expressive, suitable for profile picture: ";
