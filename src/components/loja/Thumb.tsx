/* eslint-disable @next/next/no-img-element */
export function Thumb({ imageKey, alt }: { imageKey: string | null; alt: string }) {
  return imageKey ? <img className="thumb" src={`/midia/${imageKey}-480.webp`} alt={alt} width={64} height={64} /> : <div className="thumb" aria-hidden="true" />;
}
