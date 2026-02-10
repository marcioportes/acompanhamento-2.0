# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"date-fns\" from \"src/utils/calculations.js\". Does the file exist?"
  - generic [ref=e5]: C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/src/utils/calculations.js:1:104
  - generic [ref=e6]: "1 | import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isWithinInterval } from 'date-fns'; | ^ 2 | import { ptBR } from 'date-fns/locale'; 3 |"
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:28999:43) at TransformPluginContext.error (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:28996:14) at normalizeUrl (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:27119:18) at async file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:27177:32 at async Promise.all (index 0) at async TransformPluginContext.transform (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:27145:4) at async EnvironmentPluginContainer.transform (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:28797:14) at async loadAndTransform (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:22670:26) at async viteTransformMiddleware (file:///C:/000-Marcio/Journal/acompanhamento-2.0/acompanhamento-2.0/node_modules/vite/dist/node/chunks/config.js:24542:20)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.js
    - text: .
```