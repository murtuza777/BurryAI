'use client'

import Image from 'next/image'

type BrandIdentityProps = {
  size?: number
  textClassName?: string
  className?: string
}

export function BrandIdentity({
  size = 32,
  textClassName = 'text-2xl font-bold text-cyan-400',
  className = ''
}: BrandIdentityProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 leading-none ${className}`}>
      <div
        className="relative shrink-0 overflow-hidden rounded-md translate-y-[1px]"
        style={{ width: size, height: size }}
      >
        <Image
          src="/burryaiLogo.png"
          alt="BurryAI logo"
          fill
          sizes={`${size}px`}
          className="object-cover scale-[1.32]"
          priority
        />
      </div>
      <span className={`inline-block leading-none tracking-tight ${textClassName}`}>BurryAI</span>
    </div>
  )
}
