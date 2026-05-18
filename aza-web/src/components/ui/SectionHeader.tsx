interface SectionHeaderProps {
  label: string;
  heading: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  label,
  heading,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  const wrapClass =
    align === "center"
      ? "text-center max-w-[600px] mx-auto mb-12"
      : "max-w-[600px] mb-12";

  return (
    <div className={`${wrapClass}${className ? ` ${className}` : ""}`}>
      <p
        className="reveal text-[0.75rem] font-bold tracking-[0.1em] uppercase mb-2"
        style={{ color: "#174717" }}
      >
        {label}
      </p>
      <h2
        className="reveal text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-[-0.02em] mb-4"
        data-delay="80"
        style={{ color: "var(--aza-text)" }}
      >
        {heading}
      </h2>
      {description && (
        <p
          className="reveal text-[1.05rem] leading-[1.7]"
          data-delay="160"
          style={{ color: "var(--aza-text-secondary)" }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
