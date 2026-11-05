"use client";

import { createContext, useContext } from "react";

const CurrentUserContext = createContext<string>("You");

/** Tells every page who is signed in, so the activity log can name the person. Preview mode has no name, so it says "You". */
export function CurrentUserProvider({ name, children }: { name?: string; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={name?.trim() || "You"}>{children}</CurrentUserContext.Provider>;
}

export const useCurrentUserName = (): string => useContext(CurrentUserContext);
