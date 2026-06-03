export async function sendPushover({
  title,
  message,
  url,
  urlTitle,
  priority = 0,
}: {
  title: string;
  message: string;
  url?: string;
  urlTitle?: string;
  priority?: -2 | -1 | 0 | 1;
}) {
  const token = process.env.PUSHOVER_API_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) {
    console.warn("[pushover] missing env vars:", { hasToken: !!token, hasUser: !!user });
    return;
  }

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        user,
        title,
        message,
        url,
        url_title: urlTitle,
        priority,
        sound: "pushover",
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[pushover] HTTP", res.status, body);
    } else {
      console.log("[pushover] sent:", body);
    }
  } catch (err) {
    console.error("[pushover] fetch failed:", err);
  }
}
