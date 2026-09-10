import {openFile,writeProject,downloadBlob} from '../project/files';
/** Standalone services; future host implementations can supply the same boundary. */
export interface HostAdapter {
 getInitialText():Promise<string>;
 openProject:typeof openFile;
 saveProject:typeof writeProject;
 exportImage:(blob:Blob,name:string)=>void;
}
export const standaloneAdapter:HostAdapter={async getInitialText(){return ''},openProject:openFile,saveProject:writeProject,exportImage:downloadBlob};
