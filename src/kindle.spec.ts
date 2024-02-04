import "dotenv/config";
import { test, expect, describe } from "vitest";
import { Kindle, KindleConfiguration, TLSClientResponseData } from "./kindle";
import { useScenario } from "./__test__/scenario";
import { singleBook } from "./__test__/scenarios/single-book";
import { multiplePages } from "./__test__/scenarios/multiple-pages";
import { startSession } from "./__test__/scenarios/start-session";
import { signinRedirect } from "./__test__/scenarios/signin-redirect";
import { getError } from "./__test__/get-error";
import { Filter } from "./query-filter";
import { AuthSessionError } from "./errors/auth-session-error";
import { unexpectedResponse } from "./__test__/scenarios/unexpected-response";
import { UnexpectedResponseError } from "./errors/unexpected-response-error";

const cookies = process.env.COOKIES;

function config(): KindleConfiguration {
  const deviceToken = process.env.DEVICE_TOKEN;
  if (!(deviceToken && cookies)) {
    throw Error("Invalid configuration");
  }
  return {
    deviceToken,
    cookies,
    tlsServer: {
      // rome-ignore lint/style/noNonNullAssertion: <explanation>
      apiKey: process.env.TLS_SERVER_API_KEY!,
      // rome-ignore lint/style/noNonNullAssertion: <explanation>
      url: process.env.TLS_SERVER_URL!,
    },
  };
}

test("should fetch first page when created", async () => {
  // given
  const { getBookDetails } = useScenario(singleBook);
  useScenario(startSession({ books: getBookDetails.meta.books }), {
    append: true,
  });

  // when
  const kindle = await Kindle.fromConfig(config());

  // then
  expect(kindle.defaultBooks).toMatchSnapshot();
  expect(await kindle.defaultBooks[0].fullDetails()).toMatchSnapshot();
});

describe("pagination", () => {
  test.each([
    {
      fetchAllPages: undefined,
    },
    {
      fetchAllPages: false,
    },
  ] satisfies Filter[])(
    "should only get the first page of book results when %s",
    async (filter) => {
      // given
      useScenario(startSession()); // used for initial setup
      const kindle = await Kindle.fromConfig(config());
      expect(kindle.defaultBooks.length).toBe(0);

      useScenario(multiplePages); // used for this test

      // when
      const books = await kindle.books({ filter });

      // then
      expect(books).toMatchSnapshot();
      expect(books.length).toBe(1);
    }
  );

  test("should fetch all books when fetchAllPages=true", async () => {
    // given
    useScenario(startSession()); // used for initial setup
    const kindle = await Kindle.fromConfig(config());
    expect(kindle.defaultBooks.length).toBe(0);

    useScenario(multiplePages); // used for this test

    // when
    const books = await kindle.books({ filter: { fetchAllPages: true } });

    // then
    expect(books).toMatchSnapshot();
    expect(books.length).toBe(2);
  });
});

describe("auth errors", () => {
  test("should throw when session expired", async () => {
    // given
    const {
      startSession: {
        meta: { response },
      },
    } = useScenario(signinRedirect());

    // when
    const error = await getError(
      async (): Promise<unknown> => await Kindle.fromConfig(config())
    );

    // then
    expect(error).toBeInstanceOf(AuthSessionError);
    expect(error).toEqual(
      expect.objectContaining({
        message: "Session expired",
        response,
      })
    );
  });
});

describe("unexpected response errors", () => {
  test.each([400])(
    "should throw when response status is unexpected %s",
    async (status) => {
      // given
      const response = {
        headers: {},
        status,
        body: "{}",
        cookies: {},
        target:
          "https://read.amazon.com/kindle-library/search?query=&libraryType=BOOKS&sortType=acquisition_desc&querySize=50",
      } satisfies TLSClientResponseData;
      useScenario(unexpectedResponse({ response }));

      // when
      const error = await getError(
        async (): Promise<unknown> => await Kindle.fromConfig(config())
      );

      // then
      expect(error).toBeInstanceOf(UnexpectedResponseError);
      expect(error).toEqual(
        expect.objectContaining({
          message: `Unexpected status code: ${status}`,
          response,
        })
      );
    }
  );
});
