import { registerRootComponent } from "expo";
import App from "./App";
import { initSentry, withSentry } from "./src/sentry";

initSentry();

registerRootComponent(withSentry(App));
