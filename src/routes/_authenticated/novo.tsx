import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/novo")({
  beforeLoad: () => {
    throw redirect({ to: "/gerencial/nova" });
  },
  component: () => null,
});
