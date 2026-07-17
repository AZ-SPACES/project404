import Image from 'next/image';
import azaZ from '@/app/assets/aza-z.png';

// The Aza brand mark (green "Z" app-icon tile). Replaces the old lime "a"/"A"
// monogram used across the developer area and the OAuth consent screen.
// The PNG is a self-contained rounded tile with its own background, so no
// wrapper background/shape is needed — just size it.
export function AzaMark({
  size = 32,
  className = '',
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={azaZ}
      alt="Aza"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}
