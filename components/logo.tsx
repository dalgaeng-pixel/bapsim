import Image from "next/image";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          compact
            ? "relative h-10 w-28 overflow-hidden rounded border border-stone-200 bg-white"
            : "relative h-16 w-44 overflow-hidden rounded border border-stone-200 bg-white shadow-soft"
        }
      >
        <Image
          src="/bapsim-logo.png"
          alt="밥심"
          fill
          priority
          sizes={compact ? "112px" : "176px"}
          className="object-cover"
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-bapsim-red">밥심</p>
        <h1 className={compact ? "text-lg font-black" : "text-2xl font-black"}>
          식사배달관리
        </h1>
      </div>
    </div>
  );
}
