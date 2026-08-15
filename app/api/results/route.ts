import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { gradingResults } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type ResultPayload = {
  assessmentTitle?: string;
  studentNumber?: number;
  studentName?: string;
  className?: string;
  questionScores?: number[];
  questionMaximums?: number[];
  questionLabels?: string[];
  totalScore?: number;
  maximumScore?: number;
  needsReview?: boolean;
};

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  const detail = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;
  if (combined.includes("no such table") || combined.includes("grading_results")) {
    return "Bảng kết quả chưa sẵn sàng. Vui lòng thử lại sau khi bản cập nhật hoàn tất.";
  }
  return message;
}

async function currentOwnerKey() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const normalizedEmail = user.email.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizedEmail),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function unauthorized() {
  return Response.json(
    { error: "Vui lòng đăng nhập để sử dụng sổ kết quả." },
    { status: 401, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const ownerKey = await currentOwnerKey();
    if (!ownerKey) return unauthorized();
    const url = new URL(request.url);
    const assessment = url.searchParams.get("assessment")?.trim();
    const db = await getDb();
    const rows = assessment
      ? await db
          .select()
          .from(gradingResults)
          .where(
            and(
              eq(gradingResults.ownerKey, ownerKey),
              eq(gradingResults.assessmentTitle, assessment),
            ),
          )
          .orderBy(asc(gradingResults.className), asc(gradingResults.studentNumber), desc(gradingResults.id))
          .limit(500)
      : await db
          .select()
          .from(gradingResults)
          .where(eq(gradingResults.ownerKey, ownerKey))
          .orderBy(asc(gradingResults.className), asc(gradingResults.studentNumber), desc(gradingResults.id))
          .limit(500);
    return Response.json({
      results: rows.map((row) => ({
        id: row.id,
        assessmentTitle: row.assessmentTitle,
        studentNumber: row.studentNumber,
        studentName: row.studentName,
        className: row.className,
        questionScores: JSON.parse(row.questionScores) as number[],
        questionMaximums: JSON.parse(row.questionMaximums) as number[],
        questionLabels: JSON.parse(row.questionLabels) as string[],
        totalScore: row.totalScore,
        maximumScore: row.maximumScore,
        needsReview: row.needsReview,
        createdAt: row.createdAt,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerKey = await currentOwnerKey();
    if (!ownerKey) return unauthorized();
    const payload = (await request.json()) as ResultPayload;
    const assessmentTitle = payload.assessmentTitle?.trim() ?? "";
    const studentName = payload.studentName?.trim() ?? "";
    const className = payload.className?.trim() ?? "";
    const studentNumber = Number(payload.studentNumber);
    const questionScores = payload.questionScores ?? [];
    const questionMaximums = payload.questionMaximums ?? [];
    const questionLabels = payload.questionLabels ?? [];

    if (!assessmentTitle || !studentName || !className || !Number.isInteger(studentNumber) || studentNumber < 1) {
      return Response.json({ error: "Cần nhập đủ STT, họ tên, lớp và tên bài kiểm tra." }, { status: 400 });
    }
    if (!questionScores.length || questionScores.length !== questionMaximums.length) {
      return Response.json({ error: "Điểm từng câu chưa hợp lệ." }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db
      .select({ id: gradingResults.id })
      .from(gradingResults)
      .where(
        and(
          eq(gradingResults.ownerKey, ownerKey),
          eq(gradingResults.assessmentTitle, assessmentTitle),
          eq(gradingResults.className, className),
          eq(gradingResults.studentNumber, studentNumber),
        ),
      )
      .limit(1);

    const values = {
      ownerKey,
      assessmentTitle,
      studentNumber,
      studentName,
      className,
      questionScores: JSON.stringify(questionScores),
      questionMaximums: JSON.stringify(questionMaximums),
      questionLabels: JSON.stringify(questionLabels),
      totalScore: Number(payload.totalScore ?? 0),
      maximumScore: Number(payload.maximumScore ?? 0),
      needsReview: Boolean(payload.needsReview),
    };

    if (existing[0]) {
      const [updated] = await db
        .update(gradingResults)
        .set(values)
        .where(
          and(
            eq(gradingResults.id, existing[0].id),
            eq(gradingResults.ownerKey, ownerKey),
          ),
        )
        .returning();
      return Response.json({ result: updated, replaced: true });
    }

    const [created] = await db.insert(gradingResults).values(values).returning();
    return Response.json({ result: created, replaced: false }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
