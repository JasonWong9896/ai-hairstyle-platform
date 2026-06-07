import Image from 'next/image'

type HairstyleImageProps = {
  src: string
  alt: string
  width: number
  height: number
  sizes?: string
  className?: string
}

export function HairstyleImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
}: HairstyleImageProps) {
  if (/^https?:\/\//.test(src)) {
    return <img src={src} alt={alt} className={className} />
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
    />
  )
}
