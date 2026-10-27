export * from "./enums";
export * from "./institutions";
export * from "./users";
export * from "./auth";
export * from "./tags";
export * from "./projects";
export * from "./opportunities";
export * from "./applications";
export * from "./moderation";
export * from "./audit";

import type { projectMemberRoleEnum } from "./enums";
import type { institutions } from "./institutions";
import type { projects } from "./projects";
import type { users } from "./users";

export type User = typeof users.$inferSelect;
export type Institution = typeof institutions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectRole = (typeof projectMemberRoleEnum.enumValues)[number];
