// Minimal, isolated bridge: no Node.js or filesystem APIs exposed to the web app.
'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('PFMDesktopPrint',Object.freeze({
 savePDF:(html,fileName,action='preview')=>ipcRenderer.invoke('pfm:save-report-pdf',html,fileName,action)
}));
