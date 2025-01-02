import { PrismaClient } from "../../prisma/client";

export const db = new PrismaClient();

export type { Book, Author, Image } from "../../prisma/client";
export { Binding } from "../../prisma/client";