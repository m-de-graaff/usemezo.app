"use client";

import { createContext, useContext } from "react";

/**
 * How the stop button reaches the run it is stopping.
 *
 * A reply is no longer produced by the connection the browser is holding: it
 * is produced into a buffer on the server, which is what lets somebody close
 * the tab without losing it. The cost is that hanging up no longer stops
 * anything, so "stop generating" has to say so out loud, and this is the wire
 * between the button in the composer and the conversation that owns the run.
 *
 * A context rather than a prop, because the composer is six components down
 * inside a thread the assistant-ui runtime renders.
 */
const StopRunContext = createContext<() => void>(() => undefined);

export const StopRunProvider = StopRunContext.Provider;

export const useStopRun = () => useContext(StopRunContext);
