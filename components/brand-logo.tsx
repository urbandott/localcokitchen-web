import Image from "next/image";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";

type BrandLogoProps = {
  placement: "header" | "footer";
  priority?: boolean;
};

const dimensions = {
  header: { width: 54, height: 50 },
  footer: { width: 82, height: 75 },
} as const;

export function BrandLogo({ placement, priority = false }: BrandLogoProps) {
  const size = dimensions[placement];

  return (
    <Image
      alt={BRAND_NAME}
      className="h-auto object-contain"
      height={size.height}
      priority={priority}
      src={BRAND_ASSETS.logo}
      width={size.width}
    />
  );
}
