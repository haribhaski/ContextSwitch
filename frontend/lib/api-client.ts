const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export async function authorizedFetch(
  path: string,
  options: RequestInit = {}
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,

        cache:
          "no-store",

        credentials:
          "include",
      }
    );

  return response;
}


export async function responseJson<T = any>(
  response: Response
): Promise<T> {

  if (!response.ok) {

    let message =
      `Request failed (${response.status})`;

    try {

      const body =
        await response.json();

      if (
        typeof body?.detail ===
        "string"
      ) {
        message =
          body.detail;
      }

    } catch {

      // ignore
    }

    throw new Error(
      message
    );
  }

  return response.json();
}