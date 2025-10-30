import { createSubjects } from "@openauthjs/openauth/subject";
import * as v from "valibot";

export const subjects = createSubjects({
  user: v.object({
    external_id: v.string(),
    email: v.string(),
  }),
});
