import type {GenerationAdapter} from '../api/client';
import {openFile,writeProject,downloadBlob} from '../project/files';
/** Standalone services; future host implementations can supply the same boundary. */
export interface HostAdapter {
 generation?:GenerationAdapter;
 onDirtyChange?:(dirty:boolean)=>void;
 getInitialText():Promise<string>;
 openProject:typeof openFile;
 saveProject:typeof writeProject;
 exportImage:(blob:Blob,name:string)=>void|Promise<void>;
}
export const standaloneAdapter:HostAdapter={async getInitialText(){return ''},openProject:openFile,saveProject:writeProject,exportImage:downloadBlob};
