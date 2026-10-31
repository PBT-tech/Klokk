import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/event/$token")({
  component: TokenLayout,
});

function TokenLayout() {
  return <Outlet />;
}
