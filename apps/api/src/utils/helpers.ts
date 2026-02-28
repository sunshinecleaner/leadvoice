import type { PaginationParams } from "@leadvoice/shared";
import { PAGINATION_DEFAULTS } from "@leadvoice/shared";

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number(query.page) || PAGINATION_DEFAULTS.PAGE);
  const limit = Math.min(
    PAGINATION_DEFAULTS.MAX_LIMIT,
    Math.max(1, Number(query.limit) || PAGINATION_DEFAULTS.LIMIT),
  );
  const search = typeof query.search === "string" ? query.search : undefined;
  const sortBy = typeof query.sortBy === "string" ? query.sortBy : undefined;
  const sortOrder = query.sortOrder === "desc" ? "desc" : "asc";

  return { page, limit, search, sortBy, sortOrder };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
