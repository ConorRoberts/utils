import { init } from "@paralleldrive/cuid2";

export const createRequestId = init({ length: 5 });
