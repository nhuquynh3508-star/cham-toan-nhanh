import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: "Chưa đăng nhập" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return Response.json(
    { displayName: user.displayName },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
