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
export * from "./search";

import type {
  opportunityStatusEnum,
  projectCategoryEnum,
  projectMemberRoleEnum,
  projectStatusEnum,
} from "./enums";
import type { institutions } from "./institutions";
import type { opportunities } from "./opportunities";
import type { projects } from "./projects";
import type { users } from "./users";

export type User = typeof users.$inferSelect;
export type Institution = typeof institutions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectRole = (typeof projectMemberRoleEnum.enumValues)[number];
export type Opportunity = typeof opportunities.$inferSelect;
export type OpportunityStatus = (typeof opportunityStatusEnum.enumValues)[number];
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type ProjectCategory = (typeof projectCategoryEnum.enumValues)[number];
