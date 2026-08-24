import { GET as listOrCreate, POST as createPost } from "@/controllers/notes.controller";
import {
  DELETE as byIdDelete,
  GET as byIdGet,
  GET_BACKLINKS,
  PATCH as byIdPatch,
  POST_PROCESS,
} from "@/controllers/notes-by-id.controller";

export const dynamic = "force-dynamic";

export const GET = listOrCreate;
export const POST = createPost;
export const GET_ID = byIdGet;
export const PATCH_ID = byIdPatch;
export const DELETE_ID = byIdDelete;
export const POST_PROCESS_ID = POST_PROCESS;
export const GET_BACKLINKS_ID = GET_BACKLINKS;
