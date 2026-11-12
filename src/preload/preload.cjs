const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel) => (cb) => {
  const listener = (_event, ...args) => cb(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('argos', {
  getSession: () => ipcRenderer.invoke('session:get'),
  renewSession: () => ipcRenderer.invoke('session:renew'),
  getClientId: () => ipcRenderer.invoke('config:clientId'),
  logout: () => ipcRenderer.invoke('session:logout'),
  onSessionLost: subscribe('session:lost'),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setLanguage: (code) => ipcRenderer.invoke('settings:setLanguage', code),
  },
  onTopBand: subscribe('topband:visible'),
  twitchPage: {
    open: (login, bounds) => ipcRenderer.invoke('twitchPage:open', login, bounds),
    setBounds: (bounds) => ipcRenderer.send('twitchPage:setBounds', bounds),
    close: () => ipcRenderer.send('twitchPage:close'),
  },
  window: {
    setMode: (mode, size) => ipcRenderer.invoke('window:setMode', mode, size),
    fitHeight: (height) => ipcRenderer.send('window:fitHeight', height),
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    toggleFullscreen: () => ipcRenderer.send('window:toggleFullscreen'),
    exitFullscreen: () => ipcRenderer.send('window:exitFullscreen'),
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: subscribe('window:maximized'),
  },
  login: {
    start: (bounds) => ipcRenderer.invoke('login:start', bounds),
    setBounds: (bounds) => ipcRenderer.send('login:setBounds', bounds),
    cancel: () => ipcRenderer.send('login:cancel'),
    onStage: subscribe('login:stage'),
    onContentHeight: subscribe('login:contentHeight'),
  },
});
