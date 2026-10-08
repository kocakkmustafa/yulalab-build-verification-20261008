"use client";

import { createElement, useEffect, useRef, useState, type ElementType } from "react";

type Props = {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
  as?: ElementType;
};

export function StaggerWords({
  text,
  delay = 0,
  stagger = 40,
  className = "",
  as: Tag = "span",
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSeen(true);
            io.unobserve(node);
          }
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [text]);

  const words = text.split(" ");

  return createElement(
    Tag,
    { ref, className },
    words.map((word, i) => (
      <span
        key={i}
        className={"word" + (seen ? " is-in" : "")}
        style={{ transitionDelay: `${delay + i * stagger}ms` }}
      >
        {word}
        {i < words.length - 1 ? " " : ""}
      </span>
    )),
  );
}
