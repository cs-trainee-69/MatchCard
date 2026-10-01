import { useState, type ImgHTMLAttributes } from 'react'
import { imageSources } from './gameImages'

type GameImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  sizes: string
}

export function GameImage({ src, sizes, onError, ...props }: GameImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  return (
    <picture>
      {failedSource !== src && <source hidden type="image/webp" srcSet={imageSources(src)} sizes={sizes} />}
      <img {...props} src={src} decoding="async" onError={(event) => {
        setFailedSource(src)
        onError?.(event)
      }} />
    </picture>
  )
}
