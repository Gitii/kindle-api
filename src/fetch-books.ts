import { KindleBook, KindleBookData } from "./book.js";
import { HttpClient } from "./http-client.js";
import { Kindle } from "./kindle.js";
import { QueryOptions } from "./query-options.js";

export async function fetchBooks(
  client: HttpClient,
  url: string,
  version?: string
): Promise<{
  books: KindleBook[];
  sessionId: string;
  paginationToken?: string;
}> {
  type Response = {
    itemsList: KindleBookData[];
    paginationToken: string;
  };

  const resp = await client.request(url);
  const newCookies = client.extractSetCookies(resp);
  const sessionId = newCookies["session-id"];

  const body = JSON.parse(resp.body) as Response;
  return {
    books: body.itemsList.map((book) => new KindleBook(book, client, version)),
    sessionId,
    paginationToken: body.paginationToken,
  };
}

export function toUrl(query: QueryOptions): string {
  const url = new URL(Kindle.BOOKS_URL);
  const searchParams = {
    ...query,
  };

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "fetchAllPages") {
      continue; // pagination handling is internal only and not part of the kindle api
    }

    let searchKey: string;
    if (key === "searchTerm") {
      searchKey = "query";
    } else {
      searchKey = key;
    }

    if (value !== undefined) {
      url.searchParams.set(searchKey, value.toString());
    } else {
      url.searchParams.delete(searchKey);
    }
  }

  return url.toString();
}
