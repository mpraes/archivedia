import { GET as listOrCreate, POST as createPost } from "@/controllers/notes.controller";
import {
  DELETE as byIdDelete,
  GET as byIdGet,
  PATCH as byIdPatch,
} from "@/controllers/notes-by-id.controller";

export const dynamic = "force-dynamic";

export const GET = listOrCreate;
export const POST = createPost;
export const GET_ID = byIdGet;
export const PATCH_ID = byIdPatch;
export const DELETE_ID = byIdDelete;
