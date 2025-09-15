import { IPagination } from "./interfaces";

export const paginateData = (data: any[], pagination: IPagination): any[] => {
  const {page, pageSize} = pagination
  const startIndex = (page - 1) * pageSize;
  return data.slice(startIndex, startIndex + pageSize);
}