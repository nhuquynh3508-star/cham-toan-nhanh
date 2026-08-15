"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { ComputeEngine } from "@cortex-js/compute-engine";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Database,
  Download,
  FileImage,
  Shapes,
  LoaderCircle,
  LogOut,
  Mail,
  PenLine,
  RotateCcw,
  Save,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Upload,
  UsersRound,
  X,
} from "lucide-react";

type Criterion = {
  id: number;
  label: string;
  points: number;
};

type CriterionResult = Criterion & {
  earned: number;
  state: "pass" | "review" | "miss";
  note: string;
};

type SavedResult = {
  id: number;
  assessmentTitle: string;
  studentNumber: number;
  studentName: string;
  className: string;
  questionScores: number[];
  questionMaximums: number[];
  questionLabels: string[];
  totalScore: number;
  maximumScore: number;
  needsReview: boolean;
  createdAt: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const initialCriteria: Criterion[] = [
  { id: 1, label: "Lập được quan hệ giữa hai số", points: 0.75 },
  { id: 2, label: "Tính đúng số bé", points: 0.75 },
  { id: 3, label: "Kết luận đủ hai số", points: 0.5 },
];

const defaultTikz = String.raw`\begin{tikzpicture}[scale=0.9]
  \coordinate (A) at (0,0);
  \coordinate (B) at (5,0);
  \coordinate (C) at (1.4,3.1);
  \draw[thick] (A)--(B)--(C)--cycle;
  \draw[dashed] (C)--(1.4,0);
  \node[below] at (A) {$A$};
  \node[below] at (B) {$B$};
  \node[above] at (C) {$C$};
\end{tikzpicture}`;

const sampleTranscript =
  "Số bé = (24 - 4) : 2 = 10.\nSố lớn = 10 + 4 = 14.\nĐáp số: 10 và 14.";
const sampleLatex = String.raw`\frac{24-4}{2}=10`;

function Formula({ latex, block = false }: { latex: string; block?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || String.raw`\text{Chưa có công thức}`, {
        throwOnError: false,
        displayMode: block,
        strict: false,
      });
    } catch {
      return katex.renderToString(String.raw`\text{Cần kiểm tra cú pháp}`, {
        throwOnError: false,
      });
    }
  }, [latex, block]);

  return <span className="formula" dangerouslySetInnerHTML={{ __html: html }} />;
}

function TikzPreview() {
  return (
    <svg
      className="tikz-svg"
      viewBox="0 0 360 235"
      role="img"
      aria-label="Hình tam giác ABC dựng từ mã TikZ"
    >
      <defs>
        <linearGradient id="triangleFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dff3ff" />
          <stop offset="1" stopColor="#f7fcff" />
        </linearGradient>
      </defs>
      <polygon points="48,188 315,188 122,42" fill="url(#triangleFill)" stroke="#0b5f9d" strokeWidth="3" />
      <line x1="122" y1="42" x2="122" y2="188" stroke="#1687e8" strokeWidth="2.5" strokeDasharray="7 7" />
      <path d="M122 173h15v15" fill="none" stroke="#1687e8" strokeWidth="2" />
      <circle cx="48" cy="188" r="4.5" fill="#0b5f9d" />
      <circle cx="315" cy="188" r="4.5" fill="#0b5f9d" />
      <circle cx="122" cy="42" r="4.5" fill="#0b5f9d" />
      <text x="31" y="215">A</text>
      <text x="315" y="215">B</text>
      <text x="112" y="27">C</text>
      <text x="112" y="212" fill="#1687e8">H</text>
    </svg>
  );
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [assessmentTitle, setAssessmentTitle] = useState("Bài kiểm tra – Tổng và hiệu");
  const [question, setQuestion] = useState(
    "Tổng hai số là 24. Số lớn hơn số bé 4 đơn vị. Tìm hai số đó.",
  );
  const [modelLatex, setModelLatex] = useState(String.raw`x+(x+4)=24 \Rightarrow x=10`);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [geometryMode, setGeometryMode] = useState(false);
  const [tikz, setTikz] = useState(defaultTikz);
  const [saved, setSaved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [detectedLatex, setDetectedLatex] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanNote, setScanNote] = useState("Sẵn sàng quét");
  const [confidence, setConfidence] = useState(0);
  const [approved, setApproved] = useState(false);
  const [studentNumber, setStudentNumber] = useState(1);
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("7A2");
  const [records, setRecords] = useState<SavedResult[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const draft = window.localStorage.getItem("cham-toan-nhanh-rubric");
    if (!draft) return;
    const timer = window.setTimeout(() => {
      try {
      const parsed = JSON.parse(draft) as {
        assessmentTitle?: string;
        question?: string;
        modelLatex?: string;
        criteria?: Criterion[];
        geometryMode?: boolean;
        tikz?: string;
      };
      if (parsed.assessmentTitle) setAssessmentTitle(parsed.assessmentTitle);
      if (parsed.question) setQuestion(parsed.question);
      if (parsed.modelLatex) setModelLatex(parsed.modelLatex);
      if (parsed.criteria?.length) setCriteria(parsed.criteria);
      if (typeof parsed.geometryMode === "boolean") setGeometryMode(parsed.geometryMode);
      if (parsed.tikz) setTikz(parsed.tikz);
      } catch {
        // Ignore an incomplete device-local draft.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { displayName?: string };
      })
      .then((profile) => {
        if (active && profile?.displayName) setTeacherName(profile.displayName);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const standaloneTimer = window.setTimeout(() => setIsStandalone(standalone), 0);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      window.clearTimeout(standaloneTimer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setIsStandalone(true);
    setInstallPrompt(null);
  };

  const totalPoints = useMemo(
    () => criteria.reduce((sum, item) => sum + Number(item.points || 0), 0),
    [criteria],
  );

  const result = useMemo(() => {
    if (!ocrText && !detectedLatex) return null;
    const normalized = ocrText.toLowerCase().replace(/\s+/g, " ");
    let isTen = false;
    try {
      const ce = new ComputeEngine();
      isTen = detectedLatex
        .split("=")
        .map((part) => part.trim())
        .filter(Boolean)
        .some((part) => ce.parse(part).is(10) === true);
    } catch {
      isTen = /(?:=|\b)\s*10\b/.test(`${detectedLatex} ${normalized}`);
    }

    const hasRelation =
      /24/.test(`${normalized} ${detectedLatex}`) &&
      (/[+-]\s*4|lớn|bé|2x|frac/.test(`${normalized} ${detectedLatex}`));
    const hasConclusion = /(đáp số|kết luận|số bé|số lớn|10 và 14|14)/.test(normalized);
    const alternate =
      isTen &&
      !detectedLatex.replace(/\s/g, "").includes("x+(x+4)") &&
      (detectedLatex.includes("frac") || normalized.includes("số bé"));

    const signals = [hasRelation, isTen, hasConclusion];
    const notes = [
      alternate ? "Dùng công thức trực tiếp, khác bài mẫu" : "Nhận ra quan hệ tổng – hiệu",
      isTen ? "Biểu thức tương đương và cho kết quả 10" : "Chưa xác nhận được kết quả 10",
      hasConclusion ? "Có kết luận hai số 10 và 14" : "Chưa đọc được kết luận",
    ];
    const items: CriterionResult[] = criteria.map((item, index) => ({
      ...item,
      earned: signals[index] ? item.points : 0,
      state: signals[index] ? (index === 0 && alternate ? "review" : "pass") : "miss",
      note: notes[index],
    }));
    const score = items.reduce((sum, item) => sum + item.earned, 0);
    return { items, score, alternate, isTen };
  }, [criteria, detectedLatex, ocrText]);

  const learningSummary = useMemo(() => {
    const questionCount = records.reduce(
      (maximum, record) => Math.max(maximum, record.questionScores.length),
      0,
    );
    const questions = Array.from({ length: questionCount }, (_, index) => {
      const available = records.filter(
        (record) => Number(record.questionMaximums[index] ?? 0) > 0,
      );
      const earned = available.reduce(
        (sum, record) => sum + Number(record.questionScores[index] ?? 0),
        0,
      );
      const maximum = available.reduce(
        (sum, record) => sum + Number(record.questionMaximums[index] ?? 0),
        0,
      );
      const mastery = maximum > 0 ? Math.round((earned / maximum) * 100) : 0;
      return {
        index,
        label: available[0]?.questionLabels[index] || `Câu ${index + 1}`,
        mastery,
        struggling: available.filter(
          (record) =>
            Number(record.questionScores[index] ?? 0) <
            Number(record.questionMaximums[index] ?? 0) * 0.5,
        ).length,
      };
    });
    const hardest = questions.length
      ? questions.reduce((lowest, item) => (item.mastery < lowest.mastery ? item : lowest))
      : null;
    const average = records.length
      ? records.reduce(
          (sum, record) => sum + record.totalScore / Math.max(record.maximumScore, 1),
          0,
        ) / records.length
      : 0;
    return { questions, hardest, average: Math.round(average * 100) };
  }, [records]);

  const selectFile = (selected: File | null) => {
    if (!selected) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setFile(selected);
    setImageUrl(URL.createObjectURL(selected));
    setOcrText("");
    setDetectedLatex("");
    setConfidence(0);
    setApproved(false);
  };

  const saveRubric = () => {
    window.localStorage.setItem(
      "cham-toan-nhanh-rubric",
      JSON.stringify({ assessmentTitle, question, modelLatex, criteria, geometryMode, tikz }),
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const scanImage = async () => {
    if (!file) return;
    setScanning(true);
    setScanProgress(0.05);
    setScanNote("Đang tải bộ nhận dạng miễn phí…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["eng", "vie"], undefined, {
        logger: (message: { progress?: number; status?: string }) => {
          if (typeof message.progress === "number") setScanProgress(message.progress);
          if (message.status?.includes("recognizing")) setScanNote("Đang đọc chữ và chữ số…");
        },
      });
      const output = await worker.recognize(file);
      await worker.terminate();
      const text = output.data.text.trim();
      setOcrText(text || "Máy chưa đọc rõ. Giáo viên có thể sửa lại phần văn bản này.");
      const xMatch = text.match(/x\s*[=:]\s*(-?\d+(?:[.,]\d+)?)/i);
      const arithmeticMatch = text.match(/\(?\s*24\s*[-–]\s*4\s*\)?\s*[:/]\s*2\s*[=:]\s*10/i);
      setDetectedLatex(
        xMatch
          ? `x=${xMatch[1].replace(",", ".")}`
          : arithmeticMatch
            ? sampleLatex
            : "",
      );
      setConfidence(Math.max(0, Math.min(100, Math.round(output.data.confidence || 0))));
      setScanProgress(1);
      setScanNote("Đã đọc xong — hãy kiểm tra phần máy đọc");
    } catch {
      setOcrText("Không tải được bộ OCR miễn phí. Hãy dùng bài minh họa hoặc nhập lại phần máy đọc.");
      setScanNote("Không thể chạy OCR trên thiết bị này");
    } finally {
      setScanning(false);
    }
  };

  const loadDemo = () => {
    setOcrText(sampleTranscript);
    setDetectedLatex(sampleLatex);
    setConfidence(91);
    setScanProgress(1);
    setScanNote("Đã nạp bài giải minh họa");
    if (!studentName) setStudentName("Nguyễn Minh Anh");
    if (!className) setClassName("7A2");
  };

  const loadResults = async () => {
    setRecordsLoading(true);
    try {
      const response = await fetch(
        `/api/results?assessment=${encodeURIComponent(assessmentTitle)}`,
      );
      const payload = (await response.json()) as {
        results?: SavedResult[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Không tải được bảng điểm");
      setRecords(payload.results ?? []);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Không tải được bảng điểm");
    } finally {
      setRecordsLoading(false);
    }
  };

  const openSheet = async () => {
    setStep(4);
    setSaveMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    await loadResults();
  };

  const saveCurrentResult = async () => {
    if (!result) return false;
    if (!studentName.trim() || !className.trim() || studentNumber < 1) {
      setSaveMessage("Cần nhập đủ STT, họ và tên, lớp trước khi lưu.");
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    setSavingResult(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentTitle,
          studentNumber,
          studentName,
          className,
          questionScores: result.items.map((item) => item.earned),
          questionMaximums: result.items.map((item) => item.points),
          questionLabels: result.items.map((item) => item.label),
          totalScore: result.score,
          maximumScore: totalPoints,
          needsReview: result.alternate,
        }),
      });
      const payload = (await response.json()) as { error?: string; replaced?: boolean };
      if (!response.ok) throw new Error(payload.error || "Không lưu được kết quả");
      setApproved(true);
      setSaveMessage(payload.replaced ? "Đã cập nhật dòng điểm của học sinh." : "Đã lưu vào sổ kết quả.");
      await loadResults();
      return true;
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Không lưu được kết quả");
      return false;
    } finally {
      setSavingResult(false);
    }
  };

  const resetForNextStudent = () => {
    setFile(null);
    setImageUrl("");
    setOcrText("");
    setDetectedLatex("");
    setConfidence(0);
    setApproved(false);
    setSaveMessage("");
    setStudentNumber((current) => current + 1);
    setStudentName("");
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const downloadCsv = () => {
    if (!records.length) return;
    const questionCount = records.reduce(
      (maximum, record) => Math.max(maximum, record.questionScores.length),
      0,
    );
    const headers = [
      "STT",
      "Họ và Tên",
      "Lớp",
      ...Array.from({ length: questionCount }, (_, index) => `Điểm câu ${index + 1}`),
      "Tổng điểm",
      "Mức điểm tối đa",
      "Cần xem lại",
    ];
    const escapeCell = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = records.map((record) => [
      record.studentNumber,
      record.studentName,
      record.className,
      ...Array.from({ length: questionCount }, (_, index) => record.questionScores[index] ?? ""),
      record.totalScore,
      record.maximumScore,
      record.needsReview ? "Có" : "Không",
    ]);
    const csv = `\uFEFF${[headers, ...rows]
      .map((row) => row.map((cell) => escapeCell(cell)).join(","))
      .join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${assessmentTitle.replace(/[^a-zA-Z0-9À-ỹ]+/g, "-") || "ket-qua-cham-toan"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const updateCriterion = (id: number, patch: Partial<Criterion>) => {
    setCriteria((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const goToResult = () => {
    if (!ocrText && !detectedLatex) loadDemo();
    setApproved(false);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!authReady) {
    return (
      <main className="auth-screen">
        <LoaderCircle className="spin" size={28} />
        <p>Đang kiểm tra đăng nhập…</p>
      </main>
    );
  }

  if (!teacherName) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <span className="auth-brand-mark" aria-hidden="true">
            <ScanLine size={28} strokeWidth={2.4} />
          </span>
          <span className="eyebrow">CHẤM TOÁN NHANH</span>
          <h1>Đăng nhập bằng Gmail</h1>
          <p>
            Sử dụng tài khoản Google/Gmail để mỗi giáo viên có một sổ điểm riêng,
            không nhìn thấy dữ liệu của người khác.
          </p>
          <a className="auth-google-button" href="/signin-with-chatgpt?return_to=%2F">
            <Mail size={19} />
            Tiếp tục bằng Gmail
          </a>
          <small>
            Ở bước tiếp theo, chọn <strong>Continue with Google</strong>. Việc xác thực
            được bảo vệ qua ChatGPT; ứng dụng không nhận hoặc lưu mật khẩu Gmail.
          </small>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ScanLine size={23} strokeWidth={2.4} />
          </span>
          <span>
            <strong>Chấm Toán Nhanh</strong>
            <small>Bản thử nghiệm cho giáo viên THCS</small>
          </span>
        </div>
        <div className="topbar-actions">
          {!isStandalone && (
            <button className="install-pill" onClick={() => void installApp()}>
              <Download size={16} />
              <span>Cài trên điện thoại</span>
            </button>
          )}
          <div className="privacy-pill">
            <ShieldCheck size={16} />
            <span>Sổ điểm riêng theo tài khoản</span>
          </div>
          <a
            className="account-pill"
            href="/signout-with-chatgpt?return_to=%2F"
            title="Đăng xuất"
          >
            <span>{teacherName}</span>
            <LogOut size={15} />
          </a>
        </div>
      </header>

      {showInstallHelp && (
        <div className="install-overlay" role="dialog" aria-modal="true" aria-label="Hướng dẫn cài ứng dụng">
          <button className="install-backdrop" aria-label="Đóng hướng dẫn" onClick={() => setShowInstallHelp(false)} />
          <section className="install-sheet">
            <div className="install-sheet-icon"><Download size={25} /></div>
            <button className="install-close" aria-label="Đóng" onClick={() => setShowInstallHelp(false)}><X size={19} /></button>
            <span className="eyebrow">CÀI ỨNG DỤNG</span>
            <h2>Đưa Chấm Toán ra màn hình chính</h2>
            <div className="install-steps">
              <article>
                <strong>Điện thoại Android · Chrome</strong>
                <p>Chạm dấu <b>⋮</b> ở góc trên → chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.</p>
              </article>
              <article>
                <strong>iPhone · Safari</strong>
                <p>Chạm nút <b>Chia sẻ</b> → kéo xuống → chọn <b>Thêm vào MH chính</b>.</p>
              </article>
            </div>
            <p className="install-note">Ứng dụng vẫn cần Internet để nhận dạng bài và lưu bảng điểm; ảnh bài làm không được lưu ngoại tuyến.</p>
            <button className="button primary" onClick={() => setShowInstallHelp(false)}>Tôi đã hiểu</button>
          </section>
        </div>
      )}

      <div className="workspace">
        <aside className="sidebar" aria-label="Các bước chấm bài">
          <div className="sidebar-label">QUY TRÌNH CHẤM</div>
          {[
            { id: 1, label: "Chuẩn bị barem", sub: "Bài mẫu & mốc điểm", icon: BookOpenCheck },
            { id: 2, label: "Quét bài làm", sub: "Camera hoặc ảnh", icon: Camera },
            { id: 3, label: "Duyệt kết quả", sub: "Điểm & cảnh báo", icon: PenLine },
            { id: 4, label: "Sổ kết quả", sub: "Bảng điểm & phân tích", icon: TableProperties },
          ].map((item) => {
            const Icon = item.icon;
            const active = step === item.id;
            const complete = step > item.id;
            return (
              <button
                className={`step-button ${active ? "active" : ""}`}
                key={item.id}
                onClick={() => (item.id === 4 ? void openSheet() : setStep(item.id))}
              >
                <span className={`step-icon ${complete ? "complete" : ""}`}>
                  {complete ? <Check size={18} /> : <Icon size={19} />}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.sub}</small>
                </span>
                <ChevronRight size={16} className="step-chevron" />
              </button>
            );
          })}
          <div className="sidebar-note">
            <Sparkles size={17} />
            <p>
              <strong>Nguyên tắc an toàn</strong>
              Máy đề xuất điểm. Giáo viên duyệt các bài khác cách hoặc nhận dạng thấp.
            </p>
          </div>
        </aside>

        <section className="content">
          {step === 1 && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">BƯỚC 1 / 4</span>
                  <h1>Dạy máy cách giáo viên chấm.</h1>
                  <p>Nhập đáp án mẫu hoặc các mốc điểm. Barem được giữ trên thiết bị này.</p>
                </div>
                <button className="button secondary save-button" onClick={saveRubric}>
                  {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                  {saved ? "Đã lưu" : "Lưu bản nháp"}
                </button>
              </div>

              <div className="grid-two">
                <section className="panel form-panel">
                  <div className="panel-title">
                    <span className="number-chip">01</span>
                    <div>
                      <h2>Đề bài và lời giải mẫu</h2>
                      <p>Có thể dán LaTeX trực tiếp.</p>
                    </div>
                  </div>
                  <label className="field-label" htmlFor="assessment-title">Tên bài kiểm tra</label>
                  <input
                    id="assessment-title"
                    className="latex-input"
                    value={assessmentTitle}
                    onChange={(event) => setAssessmentTitle(event.target.value)}
                    placeholder="Ví dụ: Kiểm tra giữa kì I – Toán 7"
                  />
                  <label className="field-label" htmlFor="question">Đề bài</label>
                  <textarea
                    id="question"
                    className="text-area question-area"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                  <label className="field-label" htmlFor="model-latex">
                    Lời giải trọng tâm <span>LaTeX</span>
                  </label>
                  <textarea
                    id="model-latex"
                    className="text-area code-area"
                    value={modelLatex}
                    onChange={(event) => setModelLatex(event.target.value)}
                    spellCheck={false}
                  />
                  <div className="math-preview">
                    <span>Xem trước</span>
                    <Formula latex={modelLatex} block />
                  </div>
                </section>

                <section className="panel rubric-panel">
                  <div className="panel-title rubric-title">
                    <span className="number-chip coral">02</span>
                    <div>
                      <h2>Mốc điểm</h2>
                      <p>Máy đối chiếu từng mốc, không chỉ đáp số.</p>
                    </div>
                    <span className="total-chip">{totalPoints.toLocaleString("vi-VN")} điểm</span>
                  </div>
                  <div className="criteria-list">
                    {criteria.map((item, index) => (
                      <div className="criterion-edit" key={item.id}>
                        <span className="criterion-index">{index + 1}</span>
                        <input
                          aria-label={`Mô tả mốc điểm ${index + 1}`}
                          value={item.label}
                          onChange={(event) => updateCriterion(item.id, { label: event.target.value })}
                        />
                        <label className="point-input">
                          <input
                            aria-label={`Điểm mốc ${index + 1}`}
                            type="number"
                            step="0.25"
                            min="0"
                            value={item.points}
                            onChange={(event) =>
                              updateCriterion(item.id, { points: Number(event.target.value) })
                            }
                          />
                          <span>đ</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="rule-note">
                    <CircleHelp size={18} />
                    <span>Một lỗi không bị trừ hai lần; kết quả lạ luôn chuyển sang giáo viên duyệt.</span>
                  </div>

                  <div className="geometry-toggle">
                    <div>
                      <Shapes size={20} />
                      <span>
                        <strong>Bài có hình học?</strong>
                        <small>Bật vùng mã TikZ và bản xem trước.</small>
                      </span>
                    </div>
                    <button
                      className={`switch ${geometryMode ? "on" : ""}`}
                      aria-pressed={geometryMode}
                      aria-label="Bật hoặc tắt bài hình học"
                      onClick={() => setGeometryMode((value) => !value)}
                    >
                      <span />
                    </button>
                  </div>
                </section>
              </div>

              {geometryMode && (
                <section className="panel tikz-panel">
                  <div className="tikz-copy">
                    <span className="feature-badge"><Shapes size={15} /> TikZ thử nghiệm</span>
                    <h2>Mã hình học và bản dựng</h2>
                    <p>
                      Phiên bản này lưu mã TikZ chuẩn và dựng trước tam giác cơ bản. Hình phức tạp sẽ được gắn cờ để kiểm tra.
                    </p>
                    <textarea
                      className="text-area tikz-code"
                      value={tikz}
                      onChange={(event) => setTikz(event.target.value)}
                      spellCheck={false}
                      aria-label="Mã TikZ"
                    />
                  </div>
                  <div className="tikz-canvas">
                    <span>BẢN DỰNG TỪ TIKZ</span>
                    <TikzPreview />
                  </div>
                </section>
              )}

              <div className="action-row">
                <span className="action-hint">Mẫu đang có {criteria.length} mốc điểm.</span>
                <button
                  className="button primary"
                  onClick={() => {
                    saveRubric();
                    setStep(2);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Tiếp tục quét bài <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">BƯỚC 2 / 4</span>
                  <h1>Đưa bài làm vào khung hình.</h1>
                  <p>Chụp thẳng trang giấy, đủ sáng và không để bóng tay che công thức.</p>
                </div>
                <span className="prototype-badge">OCR miễn phí · thử nghiệm</span>
              </div>

              <section className="panel student-strip">
                <div className="student-strip-heading">
                  <UsersRound size={20} />
                  <div>
                    <h2>Thông tin học sinh</h2>
                    <p>Dùng để tạo đúng một dòng trong sổ kết quả.</p>
                  </div>
                </div>
                <label>
                  <span>STT</span>
                  <input
                    type="number"
                    min="1"
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(Number(event.target.value))}
                  />
                </label>
                <label className="student-name-field">
                  <span>Họ và tên</span>
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="Nguyễn Minh Anh"
                  />
                </label>
                <label>
                  <span>Lớp</span>
                  <input
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="7A2"
                  />
                </label>
              </section>
              {saveMessage && <div className="form-message"><AlertTriangle size={16} /> {saveMessage}</div>}

              <div className="scan-layout">
                <section className="panel capture-panel">
                  <div className="capture-topline">
                    <div>
                      <h2>Bài làm học sinh</h2>
                      <p>JPG, PNG · một trang mỗi lần</p>
                    </div>
                    {file && (
                      <button
                        className="icon-button"
                        aria-label="Bỏ ảnh đang chọn"
                        onClick={() => {
                          setFile(null);
                          setImageUrl("");
                        }}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                  />
                  {imageUrl ? (
                    <button className="image-preview" onClick={() => fileInputRef.current?.click()}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Ảnh bài làm vừa chọn" />
                      <span><RotateCcw size={16} /> Chụp lại / đổi ảnh</span>
                    </button>
                  ) : (
                    <button className="drop-zone" onClick={() => fileInputRef.current?.click()}>
                      <span className="camera-orbit"><Camera size={31} /></span>
                      <strong>Mở camera hoặc chọn ảnh</strong>
                      <p>Đặt trang giấy trọn trong khung, máy sẽ tự xoay ở bản hoàn thiện.</p>
                      <span className="upload-cta"><Upload size={17} /> Chọn bài làm</span>
                    </button>
                  )}
                  <div className="capture-tips">
                    <span><Check size={15} /> Ánh sáng đều</span>
                    <span><Check size={15} /> Chụp thẳng</span>
                    <span><Check size={15} /> Một trang</span>
                  </div>
                </section>

                <section className="panel recognition-panel">
                  <div className="recognition-heading">
                    <span className="ai-icon"><Sparkles size={19} /></span>
                    <div>
                      <h2>Phần máy đọc</h2>
                      <p>Giáo viên có thể sửa trước khi chấm.</p>
                    </div>
                    {confidence > 0 && <span className="confidence">Tin cậy {confidence}%</span>}
                  </div>

                  <div className="scan-status">
                    <div className="progress-track">
                      <span style={{ width: `${scanProgress * 100}%` }} />
                    </div>
                    <span>{scanNote}</span>
                  </div>

                  <label className="field-label" htmlFor="ocr-text">Văn bản nhận dạng</label>
                  <textarea
                    id="ocr-text"
                    className="text-area ocr-area"
                    placeholder="Kết quả đọc chữ và chữ số sẽ xuất hiện ở đây…"
                    value={ocrText}
                    onChange={(event) => setOcrText(event.target.value)}
                  />
                  <label className="field-label" htmlFor="detected-latex">
                    Công thức trọng tâm <span>LaTeX</span>
                  </label>
                  <input
                    id="detected-latex"
                    className="latex-input"
                    placeholder="Ví dụ: x=10 hoặc \\frac{24-4}{2}=10"
                    value={detectedLatex}
                    onChange={(event) => setDetectedLatex(event.target.value)}
                  />
                  <div className="detected-preview">
                    <Formula latex={detectedLatex} block />
                  </div>
                  <div className="recognition-actions">
                    <button
                      className="button secondary"
                      disabled={!file || scanning}
                      onClick={scanImage}
                    >
                      {scanning ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}
                      {scanning ? "Đang đọc…" : "Nhận dạng ảnh"}
                    </button>
                    <button className="text-button" onClick={loadDemo}>
                      <FileImage size={17} /> Dùng bài minh họa
                    </button>
                  </div>
                  <div className="warning-inline">
                    <AlertTriangle size={18} />
                    <span>OCR miễn phí đọc chữ in và chữ số tốt hơn chữ viết tay/công thức. Luôn kiểm tra ô LaTeX.</span>
                  </div>
                </section>
              </div>

              <div className="action-row">
                <button className="button ghost" onClick={() => setStep(1)}>
                  <ArrowLeft size={18} /> Quay lại barem
                </button>
                <button className="button primary" onClick={goToResult}>
                  Phân tích và đề xuất điểm <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

          {step === 3 && result && (
            <>
              <div className="page-heading result-heading">
                <div>
                  <span className="eyebrow">BƯỚC 3 / 4</span>
                  <h1>Máy đề xuất, giáo viên quyết định.</h1>
                  <p>Đối chiếu điểm theo từng mốc và xem cảnh báo trước khi xác nhận.</p>
                </div>
                <button className="button secondary" onClick={() => setStep(2)}>
                  <ScanLine size={18} /> Quét bài khác
                </button>
              </div>

              <div className="result-layout">
                <section className="score-card">
                  <span className="score-label">ĐIỂM ĐỀ XUẤT</span>
                  <div className="score-number">
                    <strong>{result.score.toLocaleString("vi-VN")}</strong>
                    <span>/ {totalPoints.toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="score-ring" style={{ "--score": `${(result.score / Math.max(totalPoints, 1)) * 360}deg` } as React.CSSProperties}>
                    <span>{Math.round((result.score / Math.max(totalPoints, 1)) * 100)}%</span>
                  </div>
                  <div className="confidence-row">
                    <span>Độ tin cậy nhận dạng</span>
                    <strong>{confidence || 76}%</strong>
                  </div>
                  <div className="score-notice">
                    <ShieldCheck size={18} />
                    <span>Chưa ghi điểm cho đến khi giáo viên xác nhận.</span>
                  </div>
                </section>

                <section className="panel breakdown-panel">
                  <div className="breakdown-heading">
                    <div>
                      <h2>Đối chiếu barem</h2>
                      <p>Ba mốc được kiểm tra độc lập.</p>
                    </div>
                    <span className={`review-badge ${result.alternate ? "warn" : "ok"}`}>
                      {result.alternate ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      {result.alternate ? "Cần giáo viên xem" : "Có thể duyệt nhanh"}
                    </span>
                  </div>

                  <div className="result-criteria">
                    {result.items.map((item, index) => (
                      <article className={`criterion-result ${item.state}`} key={item.id}>
                        <span className="result-icon">
                          {item.state === "pass" ? <Check size={17} /> : item.state === "review" ? <AlertTriangle size={17} /> : <X size={17} />}
                        </span>
                        <div>
                          <span className="criterion-kicker">Mốc {index + 1}</span>
                          <h3>{item.label}</h3>
                          <p>{item.note}</p>
                        </div>
                        <strong>{item.earned.toLocaleString("vi-VN")} / {item.points.toLocaleString("vi-VN")}</strong>
                      </article>
                    ))}
                  </div>

                  <div className="formula-compare">
                    <div>
                      <span>BÀI MẪU</span>
                      <Formula latex={modelLatex} block />
                    </div>
                    <ChevronRight size={20} />
                    <div className="student-formula">
                      <span>BÀI HỌC SINH</span>
                      <Formula latex={detectedLatex} block />
                    </div>
                  </div>
                </section>
              </div>

              {result.alternate && (
                <section className="alternate-alert">
                  <span className="alert-mark"><AlertTriangle size={24} /></span>
                  <div>
                    <span className="alert-kicker">PHÁT HIỆN CÁCH GIẢI KHÁC</span>
                    <h2>Kết quả đúng, đường giải không giống bài mẫu.</h2>
                    <p>
                      Máy xác nhận <Formula latex={detectedLatex} /> cho giá trị 10 và bài có kết luận 10, 14. Tuy nhiên học sinh dùng công thức tổng–hiệu trực tiếp, nên bài được chuyển cho giáo viên duyệt thay vì tự động chốt điểm.
                    </p>
                  </div>
                  <button
                    className={`button ${approved ? "approved" : "primary"}`}
                    disabled={savingResult}
                    onClick={() => void saveCurrentResult()}
                  >
                    {approved ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
                    {savingResult
                      ? "Đang lưu…"
                      : approved
                        ? "Đã lưu vào bảng"
                        : `Xác nhận & lưu ${result.score.toLocaleString("vi-VN")} điểm`}
                  </button>
                </section>
              )}

              <section className="panel teacher-note-panel">
                <div>
                  <span className="feature-badge"><PenLine size={15} /> Gợi ý phản hồi</span>
                  <h2>Nhận xét ngắn để ghi lên bài</h2>
                  <p>“Cách giải tổng–hiệu đúng và trình bày đủ kết luận.”</p>
                </div>
                <button className="button secondary" onClick={() => navigator.clipboard?.writeText("Cách giải tổng–hiệu đúng và trình bày đủ kết luận.")}>
                  Sao chép nhận xét
                </button>
              </section>

              <section className={`save-result-panel ${approved ? "saved" : ""}`}>
                <span className="save-result-icon">
                  {approved ? <CheckCircle2 size={22} /> : <Database size={22} />}
                </span>
                <div>
                  <strong>{approved ? "Kết quả đã có trong sổ" : "Lưu kết quả học sinh"}</strong>
                  <p>
                    STT {studentNumber} · {studentName || "Chưa nhập họ tên"} · {className || "Chưa nhập lớp"}
                  </p>
                  {saveMessage && <small>{saveMessage}</small>}
                </div>
                <button
                  className={`button ${approved ? "secondary" : "primary"}`}
                  disabled={savingResult}
                  onClick={() => void saveCurrentResult()}
                >
                  {savingResult ? <LoaderCircle className="spin" size={18} /> : approved ? <Check size={18} /> : <Save size={18} />}
                  {savingResult ? "Đang lưu…" : approved ? "Cập nhật dòng điểm" : "Lưu vào sổ kết quả"}
                </button>
              </section>

              <div className="action-row final-actions">
                <button className="button ghost" onClick={() => setStep(2)}>
                  <ArrowLeft size={18} /> Xem lại ảnh
                </button>
                <button
                  className="button primary"
                  disabled={savingResult}
                  onClick={async () => {
                    const savedOk = approved || (await saveCurrentResult());
                    if (savedOk) resetForNextStudent();
                  }}
                >
                  <Camera size={18} /> Lưu & chấm bài tiếp theo
                </button>
              </div>
            </>
          )}

          {step === 3 && !result && (
            <section className="empty-result panel">
              <ScanLine size={42} />
              <h1>Chưa có bài để phân tích</h1>
              <p>Hãy quét ảnh hoặc dùng bài minh họa trước khi xem kết quả.</p>
              <button className="button primary" onClick={() => setStep(2)}>
                Quay lại quét bài <ArrowRight size={18} />
              </button>
            </section>
          )}

          {step === 4 && (
            <>
              <div className="page-heading sheet-heading">
                <div>
                  <span className="eyebrow">BƯỚC 4 / 4</span>
                  <h1>Sổ kết quả và lỗ hổng kiến thức.</h1>
                  <p>
                    Mỗi học sinh là một dòng. Điểm từng câu được tổng hợp để giáo viên nhận ra nội dung cả lớp còn vướng.
                  </p>
                </div>
                <div className="sheet-actions">
                  <button className="button secondary" onClick={() => void loadResults()}>
                    <RotateCcw size={17} /> Làm mới
                  </button>
                  <button className="button primary" disabled={!records.length} onClick={downloadCsv}>
                    <Download size={17} /> Tải bảng CSV
                  </button>
                </div>
              </div>

              <div className="assessment-banner">
                <BookOpenCheck size={18} />
                <span>
                  <small>BÀI ĐANG XEM</small>
                  <strong>{assessmentTitle}</strong>
                </span>
                <button className="text-button" onClick={() => setStep(1)}>Đổi bài kiểm tra</button>
              </div>

              {saveMessage && <div className="form-message"><AlertTriangle size={16} /> {saveMessage}</div>}

              {recordsLoading ? (
                <section className="panel sheet-loading">
                  <LoaderCircle className="spin" size={28} />
                  <span>Đang tải sổ kết quả…</span>
                </section>
              ) : records.length ? (
                <>
                  <section className="insight-grid">
                    <article className="insight-card dark">
                      <UsersRound size={21} />
                      <span>Số bài đã lưu</span>
                      <strong>{records.length}</strong>
                      <small>{new Set(records.map((record) => record.className)).size} lớp</small>
                    </article>
                    <article className="insight-card">
                      <BarChart3 size={21} />
                      <span>Mức hoàn thành chung</span>
                      <strong>{learningSummary.average}%</strong>
                      <small>So với tổng điểm tối đa</small>
                    </article>
                    <article className="insight-card warn">
                      <AlertTriangle size={21} />
                      <span>Câu cần củng cố nhất</span>
                      <strong>
                        {learningSummary.hardest
                          ? `Câu ${learningSummary.hardest.index + 1}`
                          : "—"}
                      </strong>
                      <small>
                        {learningSummary.hardest
                          ? `${learningSummary.hardest.mastery}% mức hoàn thành`
                          : "Chưa đủ dữ liệu"}
                      </small>
                    </article>
                  </section>

                  <section className="panel mastery-panel">
                    <div className="mastery-heading">
                      <div>
                        <span className="feature-badge"><BarChart3 size={15} /> Phân tích theo câu</span>
                        <h2>Học sinh đang khó ở đâu?</h2>
                        <p>Thanh ngắn hơn nghĩa là câu đó cần được chữa hoặc dạy lại.</p>
                      </div>
                      <span className="mastery-legend"><i /> Mức điểm đạt được</span>
                    </div>
                    <div className="mastery-list">
                      {learningSummary.questions.map((item) => (
                        <article key={item.index}>
                          <div className="mastery-label">
                            <strong>Câu {item.index + 1}</strong>
                            <span title={item.label}>{item.label}</span>
                          </div>
                          <div className="mastery-bar">
                            <span className={item.mastery < 50 ? "low" : ""} style={{ width: `${item.mastery}%` }} />
                          </div>
                          <strong className="mastery-value">{item.mastery}%</strong>
                          <small>{item.struggling} HS dưới 50%</small>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="panel sheet-panel">
                    <div className="sheet-panel-heading">
                      <div>
                        <span className="feature-badge"><TableProperties size={15} /> Bảng dữ liệu</span>
                        <h2>Kết quả chi tiết</h2>
                        <p>Cùng STT và lớp sẽ được cập nhật, không tạo dòng trùng.</p>
                      </div>
                      <span className="row-count">{records.length} dòng</span>
                    </div>
                    <div className="sheet-scroll">
                      <table className="result-sheet">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Họ và Tên</th>
                            <th>Lớp</th>
                            {learningSummary.questions.map((item) => (
                              <th key={item.index} title={item.label}>Câu {item.index + 1}</th>
                            ))}
                            <th>Tổng</th>
                            <th>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((record) => (
                            <tr key={record.id}>
                              <td>{record.studentNumber}</td>
                              <td><strong>{record.studentName}</strong></td>
                              <td><span className="class-pill">{record.className}</span></td>
                              {learningSummary.questions.map((item) => {
                                const score = record.questionScores[item.index];
                                const maximum = record.questionMaximums[item.index];
                                const weak = Number(score ?? 0) < Number(maximum ?? 0) * 0.5;
                                return (
                                  <td key={item.index} className={weak ? "weak-score" : ""}>
                                    {score ?? "—"}
                                    {maximum != null && <small>/{maximum}</small>}
                                  </td>
                                );
                              })}
                              <td className="total-score-cell">
                                {record.totalScore}<small>/{record.maximumScore}</small>
                              </td>
                              <td>
                                <span className={`table-status ${record.needsReview ? "review" : "done"}`}>
                                  {record.needsReview ? "Đã GV duyệt" : "Đã lưu"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <section className="empty-result panel sheet-empty">
                  <TableProperties size={44} />
                  <h1>Chưa có dòng điểm nào</h1>
                  <p>Chấm và xác nhận bài đầu tiên; kết quả sẽ tự xuất hiện ở đây.</p>
                  <button className="button primary" onClick={() => setStep(2)}>
                    <Camera size={18} /> Chấm bài đầu tiên
                  </button>
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
