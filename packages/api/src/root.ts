import { exerciseRouter } from "./routers/exercise";
import { hydrationRouter } from "./routers/hydration";
import { miloRouter } from "./routers/milo";
import { postRouter } from "./routers/post";
import { profileRouter } from "./routers/profile";
import { workoutRouter } from "./routers/workout";
import { createCallerFactory, createTRPCRouter } from "./trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	exercise: exerciseRouter,
	hydration: hydrationRouter,
	milo: miloRouter,
	post: postRouter,
	profile: profileRouter,
	workout: workoutRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
