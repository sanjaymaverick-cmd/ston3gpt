const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function endpoint(path: string) {
  if (!apiUrl) {
    throw new Error("StoneOS API URL is not configured. Set NEXT_PUBLIC_API_URL and restart the web app.");
  }
  return `${apiUrl}${path}`;
}

async function fetchApi(path: string, options: RequestInit) {
  try {
    return await fetch(endpoint(path), options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Unable to reach the StoneOS API at ${apiUrl ?? "the configured address"}. Check that the backend is running and try again.`);
    }
    throw error;
  }
}

export async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetchApi(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function apiUpload(path: string, token: string, formData: FormData) {
  const res = await fetchApi(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}
