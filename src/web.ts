import { WEB_APP_API_SCRIPT } from "./web/api.js";
import { WEB_APP_CLIENT_STATE_SCRIPT } from "./web/client-state.js";
import { WEB_APP_EVENTS_SCRIPT } from "./web/events.js";
import { WEB_APP_RENDERERS_SCRIPT } from "./web/renderers.js";
import { WEB_APP_BODY, WEB_APP_STYLES } from "./web/shell.js";

export function renderWebAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Comphony</title>
    <style>
${WEB_APP_STYLES}
    </style>
  </head>
  <body>
${WEB_APP_BODY}

    <script>
${WEB_APP_CLIENT_STATE_SCRIPT}

${WEB_APP_RENDERERS_SCRIPT}

${WEB_APP_API_SCRIPT}

${WEB_APP_EVENTS_SCRIPT}
    </script>
  </body>
</html>`;
}
