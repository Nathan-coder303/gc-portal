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
  if (!token || !user) return;

  try {
    await fetch("https://api.pushover.net/1/messages.json", {
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
  } catch (err) {
    console.error("Pushover notification failed:", err);
  }
}
