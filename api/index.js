// Vercel function: every path is rewritten here, so the app's own headers and limits always apply.
import { vercelHandler } from '../dist/vercel.js';

const handle = vercelHandler(process.env, process.cwd());

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
