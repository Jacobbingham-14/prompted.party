import { cn } from "@/lib/utils";
import { isTrustedImageUrl } from "@/lib/imageUrl";

const AVATAR_COLORS = [
  "bg-purple-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base",
};

interface PlayerAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PlayerAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl && isTrustedImageUrl(avatarUrl)) {
    return (
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className={cn("rounded-full object-cover", sizeClass, className)}
      />
    );
  }

  const color = getColorForName(name);
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        color,
        sizeClass,
        className,
      )}
      aria-label={`${name}'s avatar`}
    >
      {initials}
    </div>
  );
}
