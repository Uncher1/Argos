// In the browser test bench (?mock) the Electron bridge, the players and Twitch are faked.
// In the app's demo mode (?demo) only the sign-in and the channel lists are.
const params = new URLSearchParams(location.search);
let deps = {};
if (params.has('mock')) {
  const { installMocks } = await import('../../dev/mocks.js');
  installMocks(new Set(params.keys()));
  deps = window.__ARGOS_TEST__;
} else if (params.has('demo')) {
  const { installDemo } = await import('../../dev/demo.js');
  deps = installDemo(window.argos);
}

const { start } = await import('./app.js');
start(deps);
