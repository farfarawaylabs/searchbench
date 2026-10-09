import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ComparePage } from "./pages/compare";
import { HistoryPage } from "./pages/history";
import { RunPage } from "./pages/run";
import { SettingsPage } from "./pages/settings";
import { Shell } from "./shell";

const rootRoute = createRootRoute({ component: Shell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: ComparePage });
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});
const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history/$runId",
  component: RunPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, historyRoute, runRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
