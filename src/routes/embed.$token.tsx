import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { ParticipantResponseView } from "@/components/klokk/participant-response";
import { getEmbedConfig, reportEmbedInteraction } from "@/lib/klokk-public.functions";

/**
 * Embeddable participant widget. Only sites on the organiser's domain allow-list
 * may frame it (Content-Security-Policy: frame-ancestors); with an empty
 * allow-list nobody can.
 */
export const Route = createFileRoute("/embed/$token")({
  loader: async ({ params }) => {
    try {
      return await getEmbedConfig({ data: { token: params.token } });
    } catch {
      return null;
    }
  },
  headers: ({ loaderData }) => ({
    "Content-Security-Policy": `frame-ancestors ${loaderData?.frameAncestors ?? "'none'"}`,
  }),
  head: () => ({
    meta: [{ title: "Find a time — Klokk" }, { name: "robots", content: "noindex" }],
  }),
  component: EmbedPage,
});

function EmbedPage() {
  const { token } = Route.useParams();
  const config = Route.useLoaderData();
  const rootRef = useRef<HTMLDivElement>(null);
  const reported = useRef(false);

  // Tell the host page how tall the widget is so it can resize the iframe.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const send = () =>
      window.parent?.postMessage({ type: "klokk:height", height: el.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, []);

  const onFirstInteraction = () => {
    if (reported.current) return;
    reported.current = true;
    reportEmbedInteraction({ data: { token } }).catch(() => {});
  };

  return (
    <div
      ref={rootRef}
      onPointerDown={onFirstInteraction}
      onKeyDown={onFirstInteraction}
      style={config?.accent ? ({ "--color-accent": config.accent } as React.CSSProperties) : {}}
    >
      <ParticipantResponseView token={token} />
    </div>
  );
}
