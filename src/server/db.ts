import { PrismaClient } from "../../prisma/client";

export const db = new PrismaClient();

export type { Book, Author, Edition, Image } from "../../prisma/client";
export { Binding } from "../../prisma/client";
export { Prisma } from "../../prisma/client";
