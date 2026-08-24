import { bootstrap } from "@/app";

// Touch the wiring once on cold load so the first request is hot.
bootstrap();

export {};
